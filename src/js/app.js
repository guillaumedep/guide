import { CATS, norm, scaleItem } from './scale.js';
import { findRecipes, suggestions, BASICS, words } from './frigo.js';

/* ---------- État ---------- */
const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Mémorisé sur l'appareil (cases cochées, nombre de personnes). Même clés que le prototype.
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const state = { cat: 'all', q: '' };
let RECIPES = [];
let TIPS = [];   // astuces de cuisine (data/astuces.json)
let current = null;

const plural = (n, s, p) => n > 1 ? p : s;
// Mots japonais décoratifs (purement visuels, masqués aux lecteurs d'écran)
const KANA = { viande: '肉', poisson: '魚', vegetarien: '菜食', entree: '前菜', accompagnement: '副菜', dessert: 'デザート' };
const jp = t => `<span class="jp" aria-hidden="true">${t}</span>`;
const TITLE_COLORS = ['var(--red)', 'var(--yellow)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--pink)', 'var(--orange)'];
// Une couleur par lettre ; chaque mot reste insécable pour ne pas être coupé en fin de ligne
const mangaTitle = txt => { let i = 0; return txt.split(' ').map(w => '<span class="w">' + [...w].map(ch => {
  const k = i++; return `<span style="--c:${TITLE_COLORS[k % TITLE_COLORS.length]};--rot:${(k % 3 - 1) * 3}deg">${esc(ch)}</span>`;
}).join('') + '</span>').join(' '); };
// Mascotte onigiri (dessin vectoriel, pas de fichier externe)
const MASCOT = `<svg class="mascot" viewBox="0 0 100 100" aria-hidden="true">
  <path class="steam" d="M38 14c-4-5 4-8 0-13" fill="none" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>
  <path class="steam" d="M62 14c-4-5 4-8 0-13" fill="none" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>
  <path d="M50 18c9 0 16 8 22 19l13 24c7 13 1 30-16 30H31C14 91 8 74 15 61l13-24c6-11 13-19 22-19z" fill="#fff" stroke="#1b1720" stroke-width="4" stroke-linejoin="round"/>
  <path d="M30 70h40v21H30z" fill="#1b1720"/><path d="M33 74h34v14H33z" fill="#2e6b4f"/>
  <circle cx="38" cy="52" r="4.5" fill="#1b1720"/><circle cx="62" cy="52" r="4.5" fill="#1b1720"/>
  <circle cx="39.5" cy="50.5" r="1.5" fill="#fff"/><circle cx="63.5" cy="50.5" r="1.5" fill="#fff"/>
  <ellipse cx="29" cy="60" rx="6" ry="3.5" fill="#ff8fc2"/><ellipse cx="71" cy="60" rx="6" ry="3.5" fill="#ff8fc2"/>
  <path d="M45 58q5 5 10 0" fill="none" stroke="#1b1720" stroke-width="3" stroke-linecap="round"/>
</svg>`;
const catOf = id => CATS.find(c => c.id === id) || { id, label: id, emoji: '🍽️' };

// Vignette : image compressée si elle existe, sinon emoji sur fond décoré.
// data-fb : en cas d'échec de chargement, on revient à l'emoji (voir écouteur 'error').
const tile = (r, cls) => `<span class="${cls} tile" aria-hidden="true">${r.emoji || '🍽️'}</span>`;
const thumb = r => r.thumb
  ? `<span class="thumb"><img src="${esc(r.thumb)}" alt="" width="72" height="72" loading="lazy" decoding="async" data-fb="thumb" data-emoji="${esc(r.emoji || '')}"></span>`
  : tile(r, 'thumb');
const heroTile = r => `<div class="hero tile"><span class="plate" aria-hidden="true">${r.emoji || '🍽️'}</span><span class="cap"><span>Le visuel s’affichera ici</span></span></div>`;

// Carte d'une recette dans une liste (accueil, frigo). « extra » : contenu ajouté sous les étiquettes.
const row = (r, extra = '') => `<a class="row cat-${esc(r.cat)}" href="#/r/${encodeURIComponent(r.id)}">${thumb(r)}
    <span><span class="t">${esc(r.title)}</span>
    <span class="pills"><span class="pill cat">${esc(catOf(r.cat).label)}</span>${r.tags.slice(0, 1).map(t => `<span class="pill">${esc(t)}</span>`).join('')}${r.total ? `<span class="pill saf">${esc(r.total)}</span>` : ''}</span>${extra}</span></a>`;
const backBar = () => `<div class="bar"><a class="back" href="#/">‹ Sommaire</a></div>`;

/* ---------- Accueil ---------- */
function renderHome() {
  document.title = 'Mes recettes';
  const n = RECIPES.length;
  app.innerHTML = `
    <header class="top">
      <div class="brand">${MASCOT}<div>
        <h1 class="title" aria-label="Mes recettes">${mangaTitle('Mes recettes')}</h1>
        <span class="kana-tag" aria-hidden="true">レシピ ・ いただきます！</span>
      </div></div>
      <p class="sub"><b>${n}</b> recette${plural(n, '', 's')} au sommaire</p>
      <label class="search"><span class="sr">Rechercher une recette</span>
        <input id="q" type="search" placeholder="Rechercher un plat, un ingrédient" autocomplete="off" enterkeyhint="search"></label>
      <a class="frigo-cta" href="#/frigo"><span class="ico" aria-hidden="true">🧺</span><span><b>Qu’est-ce que je peux cuisiner ?</b><small>Dis-moi ce que tu as, je trouve les recettes</small></span><span class="go" aria-hidden="true">›</span></a>
    </header>
    <nav class="chips" id="chips" aria-label="Thèmes"></nav>
    <main id="list"></main>`;
  document.getElementById('q').value = state.q;
  updateHome();
}

function updateHome() {
  const counts = {};
  CATS.forEach(c => counts[c.id] = RECIPES.filter(r => r.cat === c.id).length);
  const chip = (id, label, emoji, n) => `<button class="chip cat-${id}${n === 0 ? ' zero' : ''}" data-act="cat" data-cat="${id}" aria-pressed="${state.cat === id}">${emoji ? emoji + ' ' : ''}${esc(label)} <span class="c">${n}</span></button>`;
  // Les catégories vides restent affichées.
  document.getElementById('chips').innerHTML = chip('all', 'Toutes', '', RECIPES.length) + CATS.map(c => chip(c.id, c.label, c.emoji, counts[c.id])).join('');
  const q = norm(state.q.trim());
  const match = r => {
    if (state.cat !== 'all' && r.cat !== state.cat) return false;
    if (!q) return true;
    const hay = [r.title, ...r.tags, catOf(r.cat).label, ...r.groups.flatMap(g => g.items.flatMap(i => [i.n, i.np || '']))].map(norm).join(' ');
    return hay.includes(q);
  };
  const found = RECIPES.filter(match);
  let html = '';
  if (!found.length) {
    html = q ? `<div class="empty">Aucune recette ne correspond à « ${esc(state.q.trim())} ».</div>`
             : `<div class="empty">Aucune recette dans ce thème pour l’instant.</div>`;
  } else if (state.cat === 'all') {
    html = CATS.map(c => {
      const rs = found.filter(r => r.cat === c.id);
      if (!rs.length) return '';
      return `<section class="grp cat-${c.id}"><h2>${c.emoji} ${esc(c.label)} ${jp(KANA[c.id])} <span class="c">${rs.length}</span></h2>${rs.map(row).join('')}</section>`;
    }).join('');
  } else {
    html = `<section class="grp">${found.map(row).join('')}</section>`;
  }
  // Astuces : seulement sur l'accueil « Toutes », hors recherche
  if (state.cat === 'all' && !q && TIPS.length) html = tipsSection() + html;
  document.getElementById('list').innerHTML = html;
}

/* ---------- Astuces de cuisine ---------- */
const tipCount = th => th.items.length;
const tipsSection = () => `<section class="tips-home" aria-labelledby="tips-h">
  <h2 id="tips-h" class="tips-title">💡 Astuces de cuisine ${jp('コツ')}</h2>
  <div class="tip-grid">${TIPS.map(th => `<a class="tip-card c-${esc(th.color)}" href="#/astuces/${encodeURIComponent(th.id)}">
    <span class="tip-emoji" aria-hidden="true">${th.emoji}</span><span class="tip-name">${esc(th.t)}</span>
    <span class="tip-n">${tipCount(th)} astuce${plural(tipCount(th), '', 's')}</span></a>`).join('')}</div>
</section>`;

function renderTips(th) {
  document.title = th.t + ' · Astuces';
  // Numérotation continue sur l'ensemble des thèmes, comme dans la liste d'origine
  let start = 1;
  for (const x of TIPS) { if (x === th) break; start += x.items.length; }
  app.innerHTML = `${backBar()}
    <article class="tips-page c-${esc(th.color)}">
      <h1 class="tips-h1"><span aria-hidden="true">${th.emoji}</span> ${esc(th.t)}</h1>
      <ol class="tips" start="${start}">${th.items.map((it, i) => `<li class="tip">
        <span class="n" aria-hidden="true">${start + i}</span>
        <div><h2>${esc(it.t)}</h2>${it.p ? `<p>${esc(it.p)}</p>` : ''}${it.li ? `<ul>${it.li.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>
      </li>`).join('')}</ol>
      <nav class="tip-nav" aria-label="Autres thèmes d’astuces">${TIPS.filter(x => x !== th).map(x =>
        `<a class="chip c-${esc(x.color)}" href="#/astuces/${encodeURIComponent(x.id)}">${x.emoji} ${esc(x.t)}</a>`).join('')}</nav>
    </article>`;
}

/* ---------- Frigo : qu'est-ce que je peux cuisiner ? ---------- */
const frigo = {
  get have() { return store.get('frigo:have', []); },
  set have(v) { store.set('frigo:have', v); },
  get basics() { return store.get('frigo:basics', true); },
  set basics(v) { store.set('frigo:basics', v); }
};
function renderFrigo() {
  document.title = 'Qu’est-ce que je peux cuisiner ?';
  app.innerHTML = `${backBar()}
    <article class="frigo">
      <h1 class="tips-h1">🧺 Qu’est-ce que je peux cuisiner ? ${jp('冷蔵庫')}</h1>
      <p class="sub">Ajoute ce que tu as sous la main. Les recettes les plus proches apparaissent en premier, avec ce qu’il manque.</p>
      <form class="frigo-add" id="frigo-form" autocomplete="off">
        <label class="search"><span class="sr">Ajouter un ingrédient</span>
          <input id="frigo-in" type="text" placeholder="Ex. : œufs, tomates, lardons…" enterkeyhint="done"></label>
        <button class="toggle add" type="submit">Ajouter</button>
      </form>
      <div id="frigo-have" class="have"></div>
      <label class="basics"><input type="checkbox" id="frigo-basics"> J’ai le placard de base : ${BASICS.join(', ')}</label>
      <details class="sugg"><summary>Idées d’ingrédients</summary><div id="frigo-sugg" class="sugg-list"></div></details>
      <section id="frigo-res"></section>
    </article>`;
  document.getElementById('frigo-basics').checked = frigo.basics;
  updateFrigo();
}
function updateFrigo() {
  const have = frigo.have;
  document.getElementById('frigo-have').innerHTML = have.length
    ? have.map((h, i) => `<button class="chip have-chip" data-act="frigo-del" data-i="${i}" aria-label="Retirer ${esc(h)}">${esc(h)} <span aria-hidden="true">✕</span></button>`).join('')
      + `<button class="link" data-act="frigo-clear">Tout effacer</button>`
    : '<p class="hint">Rien pour l’instant.</p>';
  // Comparaison normalisée : « oeufs » et « œufs » sont le même ingrédient
  const key = x => words(x).join(' ');
  const haveKeys = new Set(have.map(key));
  document.getElementById('frigo-sugg').innerHTML = suggestions(RECIPES).filter(s => !haveKeys.has(key(s))).map(s =>
    `<button class="chip" data-act="frigo-sugg" data-v="${esc(s)}">+ ${esc(s)}</button>`).join('');
  const res = findRecipes(RECIPES, have, frigo.basics);
  const box = document.getElementById('frigo-res');
  if (!have.length) { box.innerHTML = ''; return; }
  if (!res.length) { box.innerHTML = `<div class="empty">Aucune recette n’utilise ces ingrédients. Essaie un autre mot (au singulier ou au pluriel, ça marche pareil).</div>`; return; }
  const full = res.filter(m => !m.missing.length).length;
  box.innerHTML = `<h2 class="res-h">${full ? `${full} recette${plural(full, '', 's')} faisable${plural(full, '', 's')} tout de suite` : 'Les plus proches'} ${jp('おすすめ')}</h2>
    <div class="grp">${res.map(m => row(m.r, `<span class="match">
      <span class="meter" role="img" aria-label="${m.ok.length} ingrédients sur ${m.total}"><span style="width:${Math.round(m.score * 100)}%"></span></span>
      <span class="mtxt">${m.missing.length ? `Il manque : ${esc(m.missing.map(i => i.n).join(', '))}` : '✓ Tu as tout !'}</span></span>`)).join('')}</div>
    <p class="hint">Les ingrédients « au goût » et facultatifs ne sont pas comptés.</p>`;
}
function addHave(v) {
  const items = String(v).split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
  if (!items.length) return;
  const key = x => words(x).join(' ');
  const have = frigo.have, keys = new Set(have.map(key));
  for (const x of items) if (!keys.has(key(x))) { have.push(x); keys.add(key(x)); }
  frigo.have = have; updateFrigo();
}

/* ---------- Fiche recette ---------- */
function checks(r) { return store.get('chk:' + r.id, { ing: {}, step: {} }); }
function servings(r) {
  const v = store.get('serv:' + r.id, r.base);
  return Math.min(24, Math.max(1, Number(v) || r.base));
}

function renderRecipe(r) {
  document.title = r.title;
  const c = checks(r);
  let idx = 0;
  const steps = r.steps.map(p => `
    <h3 class="ph3">${esc(p.ph)}</h3>
    <ol class="steps">${p.items.map(t => {
      const i = idx++;
      return `<li class="step${c.step[i] ? ' done' : ''}" data-act="step" data-i="${i}" role="checkbox" aria-checked="${!!c.step[i]}" tabindex="0"><span class="n">${i + 1}</span><p>${esc(t)}</p></li>`;
    }).join('')}</ol>`).join('');
  const hero = r.image
    ? `<div class="hero"><img src="${esc(r.image)}" alt="${esc(r.title)}" decoding="async" data-fb="hero" data-emoji="${esc(r.emoji || '')}"></div>`
    : heroTile(r);
  const wake = 'wakeLock' in navigator
    ? `<button class="toggle" data-act="wake" aria-pressed="${!!wakeLock}">☀️ Garder l’écran allumé</button>` : '';
  app.innerHTML = `
    <div class="bar"><a class="back" href="#/">‹ Sommaire</a></div>
    <article class="cat-${esc(r.cat)}">
      <div class="rhead">
        ${hero}
        <div>
          <h1 class="rt"><span>${esc(r.title)}</span></h1>
          <div class="pills"><span class="pill cat">${esc(catOf(r.cat).label)}</span>${r.tags.map(t => `<span class="pill">${esc(t)}</span>`).join('')}${r.source ? `<span class="pill saf">${esc(r.source)}</span>` : ''}</div>
          ${r.times && r.times.length ? `<dl class="times">${r.times.map(t => `<div><dt>${esc(t.l)}</dt><dd>${esc(t.v)}</dd></div>`).join('')}</dl>` : ''}
          ${wake ? `<div class="tools">${wake}</div>` : ''}
        </div>
      </div>

      <div class="rbody">
        <section class="ings-col">
          <div class="sh"><h2>Ingrédients ${jp('材料')}</h2><button class="link" data-act="uncheck">Tout décocher</button></div>
          <div class="stepper" role="group" aria-label="Nombre de personnes">
            <button class="rnd" data-act="minus" aria-label="Une personne de moins">−</button>
            <div class="count"><output id="serv" aria-live="polite"></output><span id="servlab"></span></div>
            <button class="rnd" data-act="plus" aria-label="Une personne de plus">+</button>
          </div>
          <p class="basenote" id="basenote"></p>
          <div id="ings"></div>
        </section>

        <section>
          <div class="sh"><h2>Préparation ${jp('作り方')}</h2></div>
          ${steps}
        </section>

        ${r.notes && r.notes.length ? `<section class="notes">
          <div class="sh"><h2>À savoir ${jp('メモ')}</h2></div>
          <ul>${r.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        </section>` : ''}
      </div>
    </article>`;
  updateIngs(r, false);
}

function updateIngs(r, animate) {
  const s = servings(r), mult = s / r.base, c = checks(r);
  document.getElementById('serv').textContent = s;
  document.getElementById('servlab').textContent = plural(s, 'personne', 'personnes');
  document.querySelector('[data-act="minus"]').disabled = s <= 1;
  document.querySelector('[data-act="plus"]').disabled = s >= 24;
  document.getElementById('basenote').innerHTML =
    `Recette de base : ${r.base} ${plural(r.base, 'personne', 'personnes')}. ${esc(r.baseNote || '')}` +
    (s !== r.base ? ` <button class="link" data-act="reset-serv">Revenir à ${r.base}</button>` : '') +
    (s !== r.base ? `<br>Les temps de cuisson ne changent pas avec le nombre de personnes.` : '');
  const box = document.getElementById('ings');
  box.innerHTML = r.groups.map(g => `
    <h3 class="gt">${esc(g.t)}${g.opt ? '<em class="tag">facultatif</em>' : ''}</h3>
    ${g.note ? `<p class="gnote">${esc(g.note)}</p>` : ''}
    <ul class="ings">${g.items.map(it => {
      const o = scaleItem(it, mult), on = !!c.ing[it.id];
      const extra = it.warn || it.hint;
      return `<li class="ing${on ? ' on' : ''}${it.warn ? ' flag' : ''}" data-act="ing" data-id="${esc(it.id)}" role="checkbox" aria-checked="${on}" tabindex="0">
        <span class="box" aria-hidden="true"></span>
        <span class="qty${o.fixed ? ' fixed' : ''}">${esc(o.q)}</span>
        <span class="nm">${it.warn ? '<span aria-hidden="true">⚠️ </span>' : ''}${esc(o.name)}${it.opt ? '<em class="tag">facultatif</em>' : ''}${extra ? `<small>${it.warn ? '<span class="sr">Attention : </span>' : ''}${esc(extra)}</small>` : ''}</span>
      </li>`;
    }).join('')}</ul>`).join('');
  if (animate) { box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump'); }
}

/* ---------- Écran allumé (Screen Wake Lock, si le navigateur le permet) ---------- */
let wakeLock = null, wantWake = false;
async function setWake(on) {
  wantWake = on;
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; syncWakeBtn(); });
    } else if (!on && wakeLock) {
      await wakeLock.release(); wakeLock = null;
    }
  } catch (e) { wakeLock = null; wantWake = false; }
  syncWakeBtn();
}
function syncWakeBtn() {
  const b = document.querySelector('[data-act="wake"]');
  if (b) b.setAttribute('aria-pressed', String(!!wakeLock));
}
document.addEventListener('visibilitychange', () => {
  // Le navigateur libère le verrou quand l'appli passe en arrière-plan : on le reprend au retour.
  if (document.visibilityState === 'visible' && wantWake && current) setWake(true);
});

/* ---------- Événements ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const a = t.dataset.act, r = current;
  if (a === 'cat') { state.cat = t.dataset.cat; updateHome(); return; }
  if (a === 'reload') { location.reload(); return; }
  if (a === 'frigo-del') { const h = frigo.have; h.splice(+t.dataset.i, 1); frigo.have = h; updateFrigo(); return; }
  if (a === 'frigo-clear') { frigo.have = []; updateFrigo(); return; }
  if (a === 'frigo-sugg') { addHave(t.dataset.v); return; }
  if (!r) return;
  if (a === 'plus' || a === 'minus') {
    const s = servings(r) + (a === 'plus' ? 1 : -1);
    store.set('serv:' + r.id, Math.min(24, Math.max(1, s)));
    updateIngs(r, true); return;
  }
  if (a === 'reset-serv') { store.set('serv:' + r.id, r.base); updateIngs(r, true); return; }
  if (a === 'ing') {
    const c = checks(r), id = t.dataset.id;
    c.ing[id] = !c.ing[id]; store.set('chk:' + r.id, c);
    t.classList.toggle('on', !!c.ing[id]); t.setAttribute('aria-checked', !!c.ing[id]); return;
  }
  if (a === 'step') {
    const c = checks(r), i = t.dataset.i;
    c.step[i] = !c.step[i]; store.set('chk:' + r.id, c);
    t.classList.toggle('done', !!c.step[i]); t.setAttribute('aria-checked', !!c.step[i]); return;
  }
  if (a === 'uncheck') { store.set('chk:' + r.id, { ing: {}, step: {} }); renderRecipe(r); return; }
  if (a === 'wake') { setWake(!wakeLock); return; }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-act="ing"],[data-act="step"]')) {
    e.preventDefault(); e.target.click();
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'frigo-form') return;
  e.preventDefault();
  const inp = document.getElementById('frigo-in');
  addHave(inp.value); inp.value = ''; inp.focus();
});
document.addEventListener('change', e => {
  if (e.target.id === 'frigo-basics') { frigo.basics = e.target.checked; updateFrigo(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { state.q = e.target.value; updateHome(); }
});
// Image manquante ou illisible : repli sur l'emoji.
document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.fb) return;
  const r = { emoji: img.dataset.emoji };
  img.parentElement.outerHTML = img.dataset.fb === 'hero' ? heroTile(r) : tile(r, 'thumb');
}, true);

function route() {
  const h = location.hash;
  const m = h.match(/^#\/r\/(.+)$/);
  const r = m && RECIPES.find(x => x.id === decodeURIComponent(m[1]));
  const mt = h.match(/^#\/astuces\/(.+)$/);
  const th = mt && TIPS.find(x => x.id === decodeURIComponent(mt[1]));
  if (r) { current = r; renderRecipe(r); }
  else {
    current = null; if (wakeLock) setWake(false);
    if (th) renderTips(th);
    else if (h === '#/frigo') renderFrigo();
    else renderHome();
  }
  window.scrollTo(0, 0);
}
// Chaque écran s'ouvre en haut de page (pas de restauration automatique du défilement).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('hashchange', route);

/* ---------- Démarrage ---------- */
async function start() {
  try {
    const res = await fetch('data/recettes.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    RECIPES = (await res.json()).recipes;
  } catch (e) {
    app.innerHTML = `<div class="err"><h1>Impossible de charger les recettes</h1>
      <p>Vérifie la connexion puis réessaie. Détail : <code>${esc(e.message)}</code></p>
      <button class="toggle" data-act="reload">Réessayer</button></div>`;
    return;
  }
  // Astuces : facultatives, l'appli fonctionne sans
  try { const t = await fetch('data/astuces.json'); if (t.ok) TIPS = (await t.json()).themes || []; } catch (e) {}
  route();
}
start();

/* ---------- Hors ligne et mises à jour (service worker) ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Recharger seulement lors d'une mise à jour, pas à la toute première installation.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return; reloading = true; location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => {
      if (document.querySelector('.upd')) return;
      const bar = document.createElement('div');
      bar.className = 'upd'; bar.setAttribute('role', 'status');
      bar.innerHTML = 'Nouvelle version disponible <button type="button">Mettre à jour</button>';
      bar.querySelector('button').onclick = () => w.postMessage('skipWaiting');
      document.body.appendChild(bar);
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
