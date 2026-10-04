# Mes recettes

Appli personnelle de recettes, en français, installable sur iPad et téléphone (PWA), utilisable hors ligne.
Site statique : aucun serveur, hébergement gratuit sur GitHub Pages.

Adresse une fois publiée : **https://guillaumedep.github.io/guide/**

> Le dépôt est public : les recettes et images publiées le sont aussi.

## Mise en ligne (une seule fois)

1. Sur GitHub : **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.
2. Fusionner le travail dans la branche `master`. Le workflow « Publier l'appli » vérifie les recettes, compresse les images et publie le site (1 à 2 minutes, onglet **Actions**).

Ensuite, chaque modification de `master` republie automatiquement.

## Installer sur l'iPad / l'iPhone

1. Ouvrir l'adresse dans **Safari**.
2. Bouton **Partager** → **Sur l'écran d'accueil**.
3. L'appli s'ouvre en plein écran et fonctionne hors ligne après la première ouverture.

Quand une nouvelle version est publiée, un bandeau « Nouvelle version disponible » propose de mettre à jour.
Les cases cochées et le nombre de personnes sont mémorisés **sur l'appareil** (pas synchronisés entre appareils ; sur iOS, l'appli de l'écran d'accueil et Safari ont des mémoires séparées).

## Ajouter une recette

Un fichier par recette, dans `recettes/`. Pas de code à toucher.

1. Copier `recettes/_modele.json` en `recettes/<id>.json` (ex. `recettes/tarte-tatin.json`). L'`id` : minuscules, chiffres, tirets.
2. Remplir les champs (voir le format ci-dessous).
3. Facultatif : ajouter l'image `images/<id>.jpg` (voir `images/LISEZMOI.md`).
4. Commit sur `master` (possible directement depuis github.com : **Add file → Create new file / Upload files**).

Si une recette est mal remplie, la publication échoue avec un message en français qui indique le fichier et le champ (onglet **Actions**). Le site en ligne n'est alors pas modifié.
Pour vérifier en local : `npm run check`.

Les fichiers dont le nom commence par `_` sont ignorés.

## Format d'une recette

| Champ | Contenu |
|---|---|
| `id` | identifiant, identique au nom du fichier |
| `title` | titre affiché |
| `cat` | `viande`, `poisson`, `vegetarien`, `entree`, `accompagnement`, `dessert` |
| `emoji` | affiché tant qu'il n'y a pas d'image |
| `image` | `null` (image trouvée automatiquement par l'`id`) ou nom d'un fichier de `images/` |
| `tags` | liste de mots-clés |
| `source` | origine de la recette |
| `base` | nombre de personnes de la recette d'origine (1 à 24) |
| `baseNote` | précision sur cette base (ex. « supposée, à confirmer ») |
| `total` | durée affichée sur la carte |
| `times` | liste `{ "l": libellé, "v": valeur }` |
| `groups` | groupes d'ingrédients `{ "t": titre, "items": [...], "opt": true, "note": "..." }` (`opt`, `note` facultatifs) |
| `steps` | phases `{ "ph": titre, "items": ["étape", ...] }` |
| `notes` | liste de remarques (« À savoir ») |

### Ingrédient

| Champ | Rôle |
|---|---|
| `id` | identifiant unique dans la recette (sert à mémoriser la case cochée) |
| `n` / `np` | nom au singulier / au pluriel (pluriel utilisé à partir de 2) |
| `qty` | quantité pour `base` personnes |
| `qty2` | haut de fourchette, en `ml` ou en `g` (« 80 à 100 ml », « 20 à 30 g ») |
| `u` | `g`, `cl`, `ml`, `càs` (cuillère à soupe), `càc` (cuillère à café), ou absent pour des pièces |
| `r: "w"` | arrondi à l'entier, minimum 1 (œufs, gousses…) |
| `fixed` | texte fixe qui ne se recalcule pas (« au goût », « 1 pincée ») |
| `opt` | ingrédient facultatif |
| `warn` | avertissement affiché en rouge (quantité incertaine…) |
| `hint` | conseil affiché en gris |

### Règles de recalcul (inchangées depuis le prototype)

- **g** : arrondi à 1 g (< 100), 5 g (100-199), 10 g (≥ 200) ; ≥ 1000 g → kg arrondi à 50 g.
- **cl** : arrondi à 0,5 cl ; ≥ 100 cl → litres.
- **ml avec fourchette** : « x à y ml », arrondi à 5.
- **g avec fourchette** : « x à y g », chaque borne arrondie comme les grammes.
- **càs, càc et pièces** : quarts (¼ ½ ¾) ; `r: "w"` → entier, minimum 1.
- Pluriel automatique à partir de 2. Nombres au format français.
- Les temps de cuisson **ne changent pas** avec le nombre de personnes (rappel affiché dès qu'on s'écarte de la base).

Ces règles sont dans `src/js/scale.js`. `npm test` vérifie qu'elles donnent exactement les mêmes résultats que le prototype (`prototype/recettes.html`) pour chaque ingrédient, de 1 à 24 personnes, et que les données des 3 recettes migrées sont identiques à celles du prototype.

## Développement

    npm install       # une fois (installe sharp, pour les images)
    npm test          # tests
    npm run dev       # construit dist/ et sert sur http://localhost:8080
    npm run build     # construit dist/ seulement

Arborescence :

    recettes/          une recette par fichier JSON
    images/            images originales (compressées à la publication)
    src/               l'appli : index.html, css/, js/, sw.js (hors ligne), manifest, icônes, polices
    tools/             build.mjs (vérif + images + dist/), serve.mjs, icons.mjs, migration du prototype
    test/              tests du calcul et de la migration
    prototype/         fichier d'origine, gardé comme référence

Polices Bricolage Grotesque et Newsreader auto-hébergées (licence SIL OFL 1.1, fichiers dans `src/fonts/`) pour fonctionner hors ligne.

## Sauvegarde

Google Drive n'exécute pas le JavaScript d'un fichier HTML : il ne peut servir que de sauvegarde, pas d'hébergement. Le dépôt GitHub contient déjà tout l'historique ; pour une copie sur Drive, télécharger le ZIP du dépôt (**Code → Download ZIP**).
