# Données Connect DS / X-Y

Sources : PokeAPI/pokeapi, commit 6bbd96bb8ef7356963b833074ca25672d23e41c4 (data/v2/csv).

- Objets : identifiants internes par génération vers les slugs du catalogue local.
- Formes : espèce/génération/forme vers Pokémon PokeAPI, types et nom de fichier cosmétique. Les game_index VI de PokeAPI étant incomplets, l’ordre des formes correspond à FormConverter de PKHeX, commit b60c6e5f1427263260061d3f8c5540b924063572 ; la position ??? d’Arceus en 4G est traitée séparément.
- Sprites : chemins existants du catalogue PokeAPI utilisé par scripts/sync-sprites.mjs ; aucun chemin de sprite cosmétique inventé au moment du rendu.
- Hors 4G–6G ou forme inconnue : illustration par défaut. Les œufs ne reçoivent aucun détail de forme/espèce/sexe/PV caché.

Voir scripts/sync-connect-game-data.mjs pour régénérer les catalogues.
