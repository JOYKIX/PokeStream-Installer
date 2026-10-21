# Vérification Connect 0.2

## Tests automatisés

dotnet run --project tests/Connect.Tests -c Release

167 vérifications : PK4/PK5, 32 valeurs de permutation, checksum, œufs, trames périmées, 18 profils Lua historiques et 18 profils RAM FR/EN, compteur invalide, lecture instable, pointeur non initialisé et alignement mémoire 32 bits et en-tête à cheval sur deux blocs de lecture.

## Vérification dans les émulateurs (16 septembre 2026)

Une ROM homebrew originale est générée à partir de données synthétiques : un Évoli surnommé Pixel, niveau 25, chromatique, 0/65 PV. Le programme ARM9 copie cette équipe dans la RAM puis boucle. Il ne contient aucun code ni asset de jeu commercial.

dotnet run --project tests/Connect.Tests -c Release -- --rom chemin/connect-test.nds
dotnet run --project tests/Connect.Probe -c Release -- PID

Résultats sur Windows x64 :

| Émulateur | Lecture directe sans script |
| --- | --- |
| melonDS 0.9.5 x64 | Validée |
| melonDS 1.1 x64 | Validée |
| DeSmuME 0.9.11 x86 dev+ | Validée |
| DeSmuME 0.9.13 x64 | Validée |

Les copies de test utilisent leur propre dossier de configuration. Pour la ROM homebrew sur DeSmuME 0.9.11 uniquement, utiliser --load-type=1 : cette version a un bogue documenté de chargement des homebrews depuis le disque. Ce réglage n’est pas nécessaire à Connect pour les jeux commerciaux.

La vérification confirme la découverte de RAM et le décodage dans ces processus réels. Elle ne remplace pas une validation de chaque édition commerciale pendant tous les événements du jeu. Le lecteur conserve la dernière équipe si les données sont temporairement invalides.

## Site

scripts/verify-connect.mjs dans le dépôt web couvre connexion e-mail, association explicite, séparation des comptes, secret de l’appareil, validation des données, overlay en direct, édition manuelle indépendante, révocation et gel de la dernière équipe. Le parcours de premier démarrage crée l’aventure depuis Connect, reprend une association échouée sans recréer l’aventure et garde la confirmation après rechargement. Il utilise des comptes temporaires supprimés à la fin.
