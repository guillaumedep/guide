// Vérifie que le module de calcul donne exactement les mêmes résultats que le prototype,
// et que les recettes migrées sont identiques aux données du prototype.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadPrototype } from '../tools/extract-prototype.mjs';
import * as S from '../src/js/scale.js';

const P = loadPrototype();
const recipes = readdirSync(new URL('../recettes/', import.meta.url))
  .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .map(f => JSON.parse(readFileSync(new URL('../recettes/' + f, import.meta.url), 'utf8')));

test('catégories identiques au prototype', () => {
  assert.deepEqual(S.CATS, JSON.parse(JSON.stringify(P.CATS)));
});

test('recettes issues du prototype inchangées', () => {
  const byId = Object.fromEntries(recipes.map(r => [r.id, r]));
  for (const r of P.RECIPES) {
    // Les notes « À savoir » peuvent être allégées (retrait des mentions de source, à ta demande) ;
    // tout le reste doit rester identique, et chaque note restante doit venir du prototype.
    const { notes, ...rest } = byId[r.id];
    const { notes: pNotes, ...pRest } = JSON.parse(JSON.stringify(r));
    assert.deepEqual(rest, pRest, r.id);
    for (const n of notes) assert.ok(pNotes.includes(n), `${r.id} : note absente du prototype « ${n} »`);
  }
});

test('scaleItem identique au prototype, pour chaque ingrédient et 1 à 24 personnes', () => {
  let n = 0;
  for (const r of P.RECIPES) for (const g of r.groups) for (const it of g.items) {
    for (let s = 1; s <= 24; s++) {
      assert.deepEqual(S.scaleItem(it, s / r.base), { ...P.scaleItem(it, s / r.base) }, `${it.id} × ${s}`);
      n++;
    }
  }
  assert.ok(n > 500);
});

test('formats identiques au prototype sur une plage de valeurs', () => {
  for (let v = 0.1; v < 3000; v = v * 1.07 + 0.3) {
    assert.equal(S.fmtG(v), P.fmtG(v));
    assert.equal(S.fmtCl(v), P.fmtCl(v));
    assert.equal(S.fracText(S.quarter(v)), P.fracText(P.quarter(v)));
  }
});

test('règles d’arrondi (exemples explicites)', () => {
  const nb = s => s.replace(/ | /g, ' ');
  assert.equal(S.fmtG(87.4), '87 g');
  assert.equal(S.fmtG(123), '125 g');
  assert.equal(S.fmtG(456), '460 g');
  assert.equal(nb(S.fmtG(1830)), '1,85 kg');
  assert.equal(S.fmtCl(12.3), '12,5 cl');
  assert.equal(S.fmtCl(140), '1,4 L');
  assert.equal(S.scaleItem({ n: 'eau', qty: 80, qty2: 100, u: 'ml' }, 1.5).q, '120 à 150 ml');
  assert.equal(S.scaleItem({ n: 'huile', qty: 1, u: 'càs' }, 1.5).q, '1 ½ càs');
  assert.deepEqual(S.scaleItem({ n: 'œuf', np: 'œufs', qty: 3, r: 'w' }, 0.25), { q: '1', name: 'œuf' });
  assert.deepEqual(S.scaleItem({ n: 'oignon', np: 'oignons', qty: 1 }, 2), { q: '2', name: 'oignons' });
  assert.deepEqual(S.scaleItem({ n: 'fenouil', qty: 0.5 }, 0.25), { q: '¼', name: 'fenouil' });
  assert.deepEqual(S.scaleItem({ n: 'sel', fixed: 'au goût' }, 3), { q: 'au goût', name: 'sel', fixed: true });
});

test('ajouts : cuillère à café et fourchette en grammes', () => {
  assert.equal(S.scaleItem({ n: 'sucre', qty: 0.5, u: 'càc' }, 1).q, '½ càc');
  assert.equal(S.scaleItem({ n: 'vinaigre', qty: 1, u: 'càc' }, 1.5).q, '1\u2009½ càc');
  assert.equal(S.scaleItem({ n: 'beurre', qty: 20, qty2: 30, u: 'g' }, 1).q, '20 à 30 g');
  assert.equal(S.scaleItem({ n: 'beurre', qty: 20, qty2: 30, u: 'g' }, 2).q, '40 à 60 g');
});

test('recherche insensible aux accents', () => {
  assert.equal(S.norm('Végétarien Œuf Crème'), 'vegetarien œuf creme');
});
