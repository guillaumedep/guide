# Images des recettes

Dépose ici l'image d'une recette en la nommant **exactement comme l'`id` de la recette** :

    images/quiche-poireaux.png
    images/ragu-boeuf-effiloche.jpg

Formats acceptés : `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`. Pas besoin de toucher à la recette : l'image est trouvée automatiquement.

La compression est automatique à la publication (`tools/build.mjs`) :

| Usage | Taille produite | Format |
|---|---|---|
| Grande image (haut de fiche) | 1200 px de large maximum, proportions conservées | WebP qualité 72 |
| Vignette (liste) | 216 × 216 px, recadrée au centre | WebP qualité 70 |

L'original reste dans ce dossier ; seules les versions compressées sont mises en ligne.
Conseil : une image en 16:10 (comme celles de Gemini en paysage), plat bien au centre. L'en-tête de la fiche est en 16:10, la vignette est carrée : les bords peuvent être rognés.
Sans image (ou si elle ne se charge pas), l'appli affiche l'emoji de la recette sur le fond à pois.
