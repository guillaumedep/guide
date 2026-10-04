import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { words, matchRecipe, findRecipes, suggestions } from '../src/js/frigo.js';

const recipes = readdirSync(new URL('../recettes/', import.meta.url)).filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .map(f => JSON.parse(readFileSync(new URL('../recettes/' + f, import.meta.url), 'utf8')));
const byId = Object.fromEntries(recipes.map(r => [r.id, r]));

test('normalisation : accents, pluriels, mots vides', () => {
  assert.deepEqual(words('Œufs de Poireaux'), ['oeuf', 'poireau']);
  assert.deepEqual(words('crème fraîche'), ['creme', 'fraiche']);
});

test('recette faisable quand on a tout', () => {
  const m = matchRecipe(byId['quiche-lorraine'], ['pâte brisée', 'lardons', 'œufs', 'crème fraîche', 'lait']);
  assert.equal(m.missing.length, 0); assert.equal(m.score, 1);
});

test('ingrédients manquants listés', () => {
  const m = matchRecipe(byId['quiche-lorraine'], ['oeufs', 'lardons']);
  assert.deepEqual(m.missing.map(i => i.n).sort(), ['crème fraîche', 'lait', 'pâte brisée']);
});

test('le placard seul ne propose rien', () => {
  assert.equal(findRecipes(recipes, ['xyz']).length, 0);
  assert.equal(findRecipes(recipes, []).length, 0);
});

test('classement : la meilleure correspondance en premier', () => {
  const res = findRecipes(recipes, ['thon', 'carottes', 'amandes', 'citron', 'coriandre', 'ail']);
  assert.equal(res[0].r.id, 'salade-carottes-amandes-thon');
  assert.equal(res[0].missing.length, 0);
});

test('pommes ≠ pommes de terre', () => {
  const ids = findRecipes(recipes, ['pommes']).map(m => m.r.id);
  assert.ok(ids.includes('grilled-cheese-bacon-oeuf-oignons-pommes'));
  assert.ok(!ids.includes('salade-pommes-de-terre-cervelas'));
  assert.ok(findRecipes(recipes, ['pommes de terre']).some(m => m.r.id === 'salade-pommes-de-terre-cervelas'));
});

test('les recettes qui utilisent le plus mes ingrédients passent devant', () => {
  const res = findRecipes(recipes, ['oeufs', 'lardons', 'crème fraîche']);
  assert.equal(res[0].r.id, 'quiche-lorraine');
});

test('suggestions non vides et sans mots vagues', () => {
  const s = suggestions(recipes);
  assert.ok(s.length > 10);
  assert.ok(!s.includes('tranche') && !s.includes('de'));
});
