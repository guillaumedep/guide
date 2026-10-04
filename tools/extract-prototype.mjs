// Extrait CATS, fonctions de calcul et RECIPES du prototype (prototype/recettes.html).
// Utilisé une fois pour la migration, et par les tests pour vérifier que rien n'a changé.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadPrototype(path = new URL('../prototype/recettes.html', import.meta.url)) {
  const html = readFileSync(path, 'utf8');
  const js = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  const pure = js.slice(js.indexOf('/*PURE-START*/'), js.indexOf('/*PURE-END*/'));
  const data = js.slice(js.indexOf('const RECIPES='), js.indexOf('/* ---------- Rendu'));
  const ctx = {};
  vm.runInNewContext(`${pure}\n${data}\nthis.out={CATS,RECIPES,scaleItem,fmtG,fmtCl,fracText,quarter,norm};`, ctx);
  return ctx.out;
}
