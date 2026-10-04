// Migration unique : écrit une recette par fichier dans recettes/.
import { writeFileSync } from 'node:fs';
import { loadPrototype } from './extract-prototype.mjs';
import { formatRecipe } from './format.mjs';

const { RECIPES } = loadPrototype();
for (const r of RECIPES) {
  writeFileSync(new URL(`../recettes/${r.id}.json`, import.meta.url), formatRecipe(r));
  console.log('recettes/' + r.id + '.json');
}
