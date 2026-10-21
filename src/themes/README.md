# Thèmes d’overlay

## Catalogue et accès

47 thèmes : 10 classiques/starters et 37 éditions de jeux, de la 1G à la 9G.
Les jeux principaux, versions complémentaires et remakes sont inclus, ainsi que Let’s Go.
Les jeux Légendes et les autres jeux dérivés sont exclus.

- Gratuits : Carbone, Ivoire, Verre, Minimal.
- Starters : Eau, Feu, Plante. Un choix permanent par compte ; les deux autres avec Pro/VIP/Owner.
- Pro/VIP/Owner : Rétro, les deux Pokédex et toutes les éditions de jeux.

Les identifiants déjà utilisés sont conservés, y compris ceux des thèmes commencés manuellement.
Les thèmes payants sont toujours revérifiés côté serveur. Le RPC public ne renvoie leur apparence qu’après l’autorisation existante ; la migration Ivoire ne modifie que la liste gratuite.

## Organisation

- `catalog.ts` : ID stable, collection, famille, console, droits, accent et illustrations par défaut.
- `shared.css` : composants communs et variables d’apparence (surfaces, texte, contours, objets, badges, compteur et PV).
- `shared/badge-imprint.tsx` : creux commun à tous les thèmes, calculé sur la transparence de chaque badge.
- `default/` : classiques et Pokédex.
- `types/` : Eau, Feu, Plante.
- `games/1G/` à `games/9G/` : un fichier par version. Les fichiers préfixés par `_` définissent la famille commune aux versions jumelles.
- `index.css` : base, familles, versions, puis bibliothèque.
- `theme-library.tsx`, `theme-sample.tsx`, `selector.css` : bibliothèque scrollable, collections, recherche et miniatures sans chargement d’images.

## Directions visuelles

| Famille | Référence de design |
| --- | --- |
| Rouge / Vert / Bleu / Jaune | LCD Game Boy, matrice de points, doubles bordures de combat |
| Or / Argent / Cristal | Game Boy Color, fenêtres crème, onglets pixel |
| Rubis / Saphir / Émeraude | Cadres GBA bleutés, terrain horizontal, angles à paliers |
| Rouge Feu / Vert Feuille | Écrans de résumé vert pâle, cadres arrondis et onglets colorés |
| Diamant / Perle / Platine | DS argentée, grille tactile et séparation des écrans |
| HeartGold / SoulSilver | Pokégear, émail chaud, écran cartographique |
| Noir / Blanc | C-Gear, graphisme contrasté, divisions diagonales |
| Noir 2 / Blanc 2 | Glace et interface technique, rails cyan/orange |
| X / Y | PSS, panneaux clairs, géométrie fine |
| Rubis Oméga / Saphir Alpha | DexNav, radar et instruments marins |
| Soleil / Lune | Courbes de l’interface Motisma, lumière circulaire |
| Ultra-Soleil / Ultra-Lune | Verre optique sombre, prismes |
| Let’s Go | Résumé Switch clair, champs ronds et tons crème |
| Épée / Bouclier | Tableaux de stade, contraste et bandes de ligue |
| Diamant Étincelant / Perle Scintillante | Résine claire et surfaces facettées |
| Écarlate / Violet | Dossier d’académie, toile marine et filets dorés |

Les versions jumelles partagent leur construction ; les palettes complètes et les motifs changent par édition. Les remakes ont leur propre famille, correspondant à leur console de sortie.
Les versions complémentaires gardent la parenté avec leur famille.
Ce sont des interfaces originales inspirées des jeux, sans copie de capture ni de logo.

## Ajouter une édition

1. Déclarer son ID et sa famille dans le catalogue.
2. Ajouter son fichier dans la génération de sortie, puis l’importer après sa famille.
3. Pour une famille nouvelle, définir sa direction dans un fichier commun `_nom.css`.
4. Couvrir aussi la boîte à badges, l’objet tenu, le compteur et les PV. Le creux des badges reste dans `shared/badge-imprint.tsx` : aucune variante par thème.
5. Un thème gratuit exige aussi la mise à jour de la liste gratuite du RPC ; un ID nouveau reste protégé par défaut.

## Rendu et données

La géométrie reste dans `styles/studio.css`, `OverlayStage` et `overlay-bounds.ts`.
Les styles respectent les échelles utilisateur et l’ordre des éléments. Les décorations restent à l’intérieur des cartes ; les ombres sont mesurées pour les recommandations OBS.
Ne pas ajouter de `overflow: hidden` sur une carte : il rognerait les sprites ou objets agrandis.

Sexe et barre de vie sont désactivés par défaut sur les scènes existantes. Ils disposent de leur propre interrupteur, taille et reset. Le sexe reste à droite du nom ; la barre de vie peut être déplacée dans l’ordre des éléments. Les valeurs numériques des PV sont facultatives.
Les PV et le sexe non renseignés restent masqués, en réservant leur hauteur. Même règle pour les œufs, sans révéler leur espèce. Les KO restent grisés.
Les anciennes dispositions à quatre éléments restent valides ; les PV sont ajoutés à la fin sans déplacer les éléments existants.

Avec le fond des badges activé, chaque badge manquant laisse une empreinte dans la matière de la boîte. Un filtre SVG unique dans le code partagé utilise la silhouette alpha exacte : ombre intérieure douce en haut, bord éclairé fin en bas, fond translucide qui conserve les couleurs et textures du thème. Aucun cadre creusé supplémentaire par emplacement. Les filtres ont des identifiants React uniques pour les aperçus et sources multiples.
Sans fond, le rendu grisé existant est conservé. La grille, les dimensions et les échelles restent identiques.

Les favoris restent liés au compte. Recherche, collection et favoris se combinent, sans changer la sélection de l’overlay.
Aucune animation permanente : seule la variation des PV utilise une transition courte, désactivée si l’utilisateur préfère réduire les animations.

## Références

- [Catalogue officiel des jeux Pokémon](https://www.pokemon.com/uk/pokemon-video-games/all-pokemon-games)
- [Rubis et Saphir — Game Boy Advance](https://www.pokemon.com/us/pokemon-video-games/pokemon-ruby-version-and-pokemon-sapphire-version/)
- [Rubis Oméga et Saphir Alpha](https://www.pokemon.com/us/pokemon-video-games/pokemon-omega-ruby-and-pokemon-alpha-sapphire)
- [Remakes de Sinnoh — site officiel](https://diamondpearl.pokemon.com/en-us/)

Validation : compilation Next.js réussie dans une copie isolée du commit publié. Aucun test automatique ni en jeu, conformément à la demande de l’utilisateur.

Vérification du creux partagé (exception autorisée) : aperçu navigateur du composant réel avec les CSS et PNG du site, sur 16 thèmes clairs, sombres et colorés ; Kanto à 100 %, Kalos à 200 % et Paldea (18 badges, grille 6 × 3) à 50 %. Aucun problème de rendu, erreur console ou doublon d’identifiant de filtre observé. Compilation TypeScript du code source réussie ; fichiers de la page profil en cours exclus de cette compilation locale.
