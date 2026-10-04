// Calcul des quantités. Logique reprise telle quelle du prototype (bloc PURE de prototype/recettes.html).
// Toute modification ici doit garder test/scale.test.mjs au vert.

export const CATS = [
  { id: 'viande', label: 'Viande', emoji: '🥩' },
  { id: 'poisson', label: 'Poisson', emoji: '🐟' },
  { id: 'vegetarien', label: 'Végétarien', emoji: '🥬' },
  { id: 'entree', label: 'Entrée', emoji: '🥗' },
  { id: 'accompagnement', label: 'Accompagnement', emoji: '🍚' },
  { id: 'dessert', label: 'Dessert', emoji: '🍰' }
];

const NF = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const FR_FRAC = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

export const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const quarter = v => Math.max(0.25, Math.round(v * 4) / 4);

export function fracText(r) {
  const w = Math.floor(r), f = r - w;
  return (w ? String(w) : '') + (f ? (w ? ' ' : '') + FR_FRAC[f] : '');
}

// g : 1 g (<100), 5 g (100-199), 10 g (≥200) ; ≥1000 → kg arrondi à 50 g
export function fmtG(v) {
  if (v >= 1000) return NF.format(Math.round(v / 50) * 50 / 1000) + ' kg';
  const step = v >= 200 ? 10 : (v >= 100 ? 5 : 1);
  return NF.format(Math.round(v / step) * step) + ' g';
}

// cl : 0,5 cl ; ≥100 cl → litres
export function fmtCl(v) {
  if (v >= 100) return NF.format(Math.round(v / 5) * 5 / 100) + ' L';
  return NF.format(Math.round(v * 2) / 2) + ' cl';
}

// Renvoie { q: texte de la quantité, name: nom (singulier/pluriel), fixed?: true }
export function scaleItem(it, mult) {
  if (it.fixed) return { q: it.fixed, name: it.n, fixed: true };
  if (it.u === 'ml' && it.qty2) {
    const f = x => Math.round(x / 5) * 5;
    return { q: NF.format(f(it.qty * mult)) + ' à ' + NF.format(f(it.qty2 * mult)) + ' ml', name: it.n };
  }
  const v = it.qty * mult;
  if (it.u === 'g') return { q: fmtG(v), name: it.n };
  if (it.u === 'cl') return { q: fmtCl(v), name: it.n };
  if (it.u === 'càs') return { q: fracText(quarter(v)) + ' càs', name: it.n };
  if (it.r === 'w') {
    const r = Math.max(1, Math.round(v));
    return { q: String(r), name: (r >= 2 && it.np) ? it.np : it.n };
  }
  const r = quarter(v);
  return { q: fracText(r), name: (r >= 2 && it.np) ? it.np : it.n };
}
