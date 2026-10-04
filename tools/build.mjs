// Construit le site publiable dans dist/ :
//  1. vérifie chaque recette de recettes/*.json (erreurs claires en français) ;
//  2. compresse les images de images/ en WebP (grande image + vignette) ;
//  3. regroupe les recettes dans dist/data/recettes.json ;
//  4. copie l'appli et prépare le service worker (hors ligne).
// Usage : node tools/build.mjs          → construit dist/
//         node tools/build.mjs --check  → vérifie seulement les recettes
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, cpSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CATS } from '../src/js/scale.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src'), REC = join(ROOT, 'recettes'), IMGSRC = join(ROOT, 'images'), DIST = join(ROOT, 'dist');
const CHECK_ONLY = process.argv.includes('--check');
const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
// Réglages de compression (modifier ici change toutes les images au prochain build).
const HERO = { width: 1200, quality: 72 };   // grande image : largeur max en px, qualité WebP
const THUMB = { size: 216, quality: 70, position: 'centre' }; // vignette carrée (72 px × 3 pour Retina), recadrée au centre

const errors = [];
const err = (file, msg) => errors.push(`${file} : ${msg}`);

/* ---------- 1. Lecture et vérification des recettes ---------- */
const UNITS = ['g', 'cl', 'ml', 'càs', 'càc'];
const catIds = CATS.map(c => c.id);
const isStr = v => typeof v === 'string' && v.trim() !== '';
const isNum = v => typeof v === 'number' && Number.isFinite(v) && v > 0;

function validate(r, file) {
  const e = msg => err(file, msg);
  if (!isStr(r.id)) e('« id » manquant');
  else if (!/^[a-z0-9-]+$/.test(r.id)) e(`« id » doit contenir uniquement a-z, 0-9 et des tirets (reçu « ${r.id} »)`);
  else if (file !== r.id + '.json') e(`le nom du fichier doit être « ${r.id}.json »`);
  if (!isStr(r.title)) e('« title » manquant');
  if (!catIds.includes(r.cat)) e(`« cat » doit valoir ${catIds.map(c => `"${c}"`).join(', ')} (reçu ${JSON.stringify(r.cat)})`);
  if (!Number.isInteger(r.base) || r.base < 1 || r.base > 24) e('« base » doit être un nombre entier de personnes entre 1 et 24');
  if (r.image != null && !isStr(r.image)) e('« image » doit être null ou un nom de fichier du dossier images/');
  for (const k of ['tags', 'times', 'groups', 'steps', 'notes']) if (r[k] !== undefined && !Array.isArray(r[k])) e(`« ${k} » doit être une liste [ … ]`);
  if (!Array.isArray(r.groups) || !r.groups.length) e('« groups » : il faut au moins un groupe d’ingrédients');
  if (!Array.isArray(r.steps) || !r.steps.length) e('« steps » : il faut au moins une phase d’étapes');
  (r.times || []).forEach((t, i) => { if (!isStr(t.l) || !isStr(t.v)) e(`times[${i}] : il faut « l » (libellé) et « v » (valeur)`); });
  const ids = new Set();
  (r.groups || []).forEach((g, gi) => {
    if (!isStr(g.t)) e(`groups[${gi}] : titre « t » manquant`);
    if (!Array.isArray(g.items) || !g.items.length) { e(`groups[${gi}] : liste « items » vide ou absente`); return; }
    g.items.forEach((it, ii) => {
      const w = `ingrédient « ${it.n || '?'} » (groups[${gi}].items[${ii}])`;
      if (!isStr(it.id)) e(`${w} : « id » manquant`);
      else if (ids.has(it.id)) e(`${w} : « id » ${it.id} déjà utilisé dans cette recette`);
      else ids.add(it.id);
      if (!isStr(it.n)) e(`${w} : nom « n » manquant`);
      if (it.fixed !== undefined) { if (!isStr(it.fixed)) e(`${w} : « fixed » doit être un texte (ex. "au goût")`); return; }
      if (!isNum(it.qty)) e(`${w} : « qty » doit être un nombre > 0 (ou utiliser "fixed": "au goût")`);
      if (it.u !== undefined && !UNITS.includes(it.u)) e(`${w} : unité « u » inconnue ${JSON.stringify(it.u)} (autorisées : ${UNITS.join(', ')}, ou rien pour des pièces)`);
      if (it.qty2 !== undefined && (!['ml', 'g'].includes(it.u) || !isNum(it.qty2) || it.qty2 <= it.qty)) e(`${w} : « qty2 » (fourchette) n’est géré qu’en ml ou en g, avec un nombre plus grand que « qty »`);
      if (it.r !== undefined && it.r !== 'w') e(`${w} : « r » ne peut valoir que "w" (arrondi à l’entier)`);
    });
  });
  (r.steps || []).forEach((p, pi) => {
    if (!isStr(p.ph)) e(`steps[${pi}] : titre de phase « ph » manquant`);
    if (!Array.isArray(p.items) || !p.items.length || !p.items.every(isStr)) e(`steps[${pi}] : « items » doit être une liste de textes`);
  });
}

const files = readdirSync(REC).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort();
const recipes = [];
const seen = new Map();
for (const f of files) {
  let r;
  try { r = JSON.parse(readFileSync(join(REC, f), 'utf8')); }
  catch (e) { err(f, `JSON invalide — ${e.message} (virgule en trop ou manquante, guillemet non fermé ?)`); continue; }
  validate(r, f);
  if (seen.has(r.id)) err(f, `même « id » que ${seen.get(r.id)}`);
  seen.set(r.id, f);
  recipes.push(r);
}

/* ---------- 2. Repérage des images ---------- */
const imgFiles = existsSync(IMGSRC) ? readdirSync(IMGSRC).filter(f => IMG_EXT.includes(extname(f).toLowerCase())) : [];
const sourceFor = r => {
  if (r.image) return imgFiles.includes(r.image) ? r.image : (err(r.id + '.json', `image « ${r.image} » introuvable dans images/`), null);
  return imgFiles.find(f => f.slice(0, -extname(f).length) === r.id) || null;
};
for (const f of imgFiles) {
  const base = f.slice(0, -extname(f).length);
  if (!recipes.some(r => r.id === base || r.image === f)) console.warn(`⚠️  images/${f} ne correspond à aucune recette (nommer le fichier <id-de-la-recette>.jpg)`);
}

if (errors.length) {
  console.error(`\n❌ ${errors.length} erreur(s) dans les recettes :\n` + errors.map(e => '  - recettes/' + e).join('\n') + '\n');
  process.exit(1);
}
console.log(`✅ ${recipes.length} recette(s) valides`);
if (CHECK_ONLY) process.exit(0);

/* ---------- 3. Construction de dist/ ---------- */
rmSync(DIST, { recursive: true, force: true });
cpSync(SRC, DIST, { recursive: true, filter: s => !s.endsWith('sw.js') });
mkdirSync(join(DIST, 'img'), { recursive: true });
mkdirSync(join(DIST, 'data'), { recursive: true });

const { default: sharp } = await import('sharp');
const hash = buf => createHash('sha256').update(buf).digest('hex').slice(0, 10);
const kb = n => (n / 1024).toFixed(0) + ' Ko';
const images = [];
for (const r of recipes) {
  const src = sourceFor(r);
  const out = { ...r, image: null, thumb: null };
  if (src) {
    const input = readFileSync(join(IMGSRC, src));
    const h = hash(Buffer.concat([input, Buffer.from(JSON.stringify([HERO, THUMB]))]));
    const heroName = `img/${r.id}-${h}.webp`, thumbName = `img/${r.id}-${h}-v.webp`;
    const img = sharp(input).rotate();   // .rotate() applique l'orientation EXIF
    await img.clone().resize({ width: HERO.width, withoutEnlargement: true }).webp({ quality: HERO.quality }).toFile(join(DIST, heroName));
    await img.clone().resize(THUMB.size, THUMB.size, { fit: 'cover', position: THUMB.position }).webp({ quality: THUMB.quality }).toFile(join(DIST, thumbName));
    out.image = heroName; out.thumb = thumbName;
    images.push(heroName, thumbName);
    console.log(`🖼️  ${src} (${kb(input.length)}) → ${kb(statSync(join(DIST, heroName)).size)} + vignette ${kb(statSync(join(DIST, thumbName)).size)}`);
  }
  recipes[recipes.indexOf(r)] = out;
}
recipes.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
writeFileSync(join(DIST, 'data', 'recettes.json'), JSON.stringify({ recipes }));

/* ---------- 4. Service worker ---------- */
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const shellFiles = walk(DIST).map(p => relative(DIST, p).split('\\').join('/'))
  .filter(p => !p.startsWith('img/') && !p.endsWith('.txt')).sort();   // les images ont leur propre cache
const version = hash(Buffer.concat(walk(DIST).sort().map(p => readFileSync(p))));
const precache = ['./', ...shellFiles];
const sw = readFileSync(join(SRC, 'sw.js'), 'utf8')
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace('__PRECACHE__', JSON.stringify(precache))
  .replace('__IMAGES__', JSON.stringify(images));
writeFileSync(join(DIST, 'sw.js'), sw);
writeFileSync(join(DIST, '.nojekyll'), '');
console.log(`📦 dist/ prêt — version ${version}, ${precache.length} fichiers en cache hors ligne, ${images.length} images`);
