// « Qu'est-ce que je peux cuisiner ? » : compare les ingrédients disponibles à ceux des recettes.
// Module pur (pas d'accès au DOM) pour pouvoir être testé.

const STOP = new Set(['de', 'd', 'du', 'des', 'la', 'le', 'les', 'l', 'en', 'a', 'au', 'aux', 'et', 'ou', 'un', 'une', 'pour', 'avec', 'sans']);
// Mots trop vagues pour identifier un ingrédient (quantités, formes, adjectifs)
const VAGUE = new Set(['tranche', 'gousse', 'botte', 'petit', 'petite', 'gros', 'grosse', 'grand', 'belle', 'beau', 'feuille', 'cube', 'boite',
  'branche', 'pincee', 'moulu', 'moulue', 'frais', 'fraiche', 'entier', 'entiere', 'hache', 'hachee', 'emince', 'emincee', 'rape', 'rapee',
  'cuit', 'cuite', 'sec', 'seche', 'verre', 'noix', 'poignee', 'bio', 'jus', 'zeste', 'bouquet', 'moyen', 'moyenne', 'fine', 'fin',
  'poudre', 'filet', 'un', 'peu', 'selon', 'besoin', 'goût', 'gout', 'chaque', 'tasse', 'ferme', 'tassee', 'fondu', 'mou', 'molle',
  'ambiante', 'temperature', 'epaisseur', 'cm', 'surgele', 'surgeles', 'separe', 'separes', 'meme', 'moule']);
// Placard de base : supposé toujours disponible si l'option est cochée
export const BASICS = ['sel', 'poivre', 'huile', 'beurre', 'eau', 'farine', 'sucre'];

export const normWord = w => {
  let s = w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  if (s.length > 3 && /[sx]$/.test(s)) s = s.slice(0, -1);   // pluriel simple : tomates → tomate, poireaux → poireau
  return s;
};
// « pomme(s) de terre » forme un seul mot, pour ne pas confondre avec les pommes
export const words = txt => String(txt).toLowerCase().replace(/pommes? de terre/g, 'pommedeterre').split(/[^a-zà-ÿœæ]+/i).filter(Boolean).map(normWord).filter(w => !STOP.has(w));

// Ingrédients qui comptent pour savoir si on peut faire la recette : ni « au goût », ni facultatifs
export const essentials = r => r.groups.flatMap(g => g.opt ? [] : g.items.filter(it => !it.fixed && !it.opt));

const itemWords = it => new Set([...words(it.n), ...(it.np ? words(it.np) : [])]);
// Un terme saisi correspond à un ingrédient si tous ses mots significatifs y figurent
const termMatches = (term, iw) => {
  const tw = words(term).filter(w => !VAGUE.has(w));
  return tw.length > 0 && tw.every(w => iw.has(w));
};

export function matchRecipe(r, have, useBasics = true) {
  const terms = [...have, ...(useBasics ? BASICS : [])];
  const ess = essentials(r);
  const ok = [], missing = [];
  for (const it of ess) {
    const iw = itemWords(it);
    (terms.some(t => termMatches(t, iw)) ? ok : missing).push(it);
  }
  // Ingrédients trouvés grâce à ce que l'utilisateur a saisi (le placard seul ne suffit pas à proposer une recette)
  const fromUser = ess.filter(it => have.some(t => termMatches(t, itemWords(it)))).length;
  return { ok, missing, total: ess.length, fromUser, score: ess.length ? ok.length / ess.length : 0 };
}

export function findRecipes(recipes, have, useBasics = true) {
  if (!have.length) return [];
  return recipes.map(r => ({ r, ...matchRecipe(r, have, useBasics) }))
    .filter(m => m.fromUser > 0)
    // 1) faisables tout de suite, 2) qui utilisent le plus de tes ingrédients, 3) où il manque le moins
    .sort((a, b) => (!b.missing.length) - (!a.missing.length) || b.fromUser - a.fromUser
      || a.missing.length - b.missing.length || a.r.title.localeCompare(b.r.title, 'fr'));
}

// Suggestions : ingrédients courants, gardés seulement s'ils servent dans au moins une recette
const COMMON = ['œufs', 'tomates', 'oignons', 'ail', 'échalotes', 'carottes', 'courgettes', 'poireaux', 'pommes de terre', 'champignons',
  'chou-fleur', 'céleri', 'asperges', 'salade frisée', 'pissenlit', 'citron', 'pommes', 'persil', 'menthe', 'coriandre', 'ciboulette',
  'poulet', 'bœuf', 'jambon', 'lardons', 'lard', 'bacon', 'cervelas', 'canard', 'foie gras', 'thon', 'mozzarella', 'gruyère', 'cheddar',
  'comté', 'fromage', 'crème fraîche', 'lait', 'yaourt', 'mayonnaise', 'moutarde', 'vinaigre', 'vin blanc', 'vin rouge', 'bouillon',
  'pâte brisée', 'pain de mie', 'pain', 'flageolets', 'boulghour', 'pâtes', 'amandes', 'pignons', 'maïs', 'chocolat', 'cornichons'];
export function suggestions(recipes) {
  const items = recipes.flatMap(essentials).map(itemWords);
  return COMMON.filter(t => items.some(iw => termMatches(t, iw)));
}
