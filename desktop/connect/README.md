# PokeStream Connect — 1.0.2

Release 1.0.2 pour Windows 10/11 x64. La lecture Switch reste expérimentale, avec repli sur sauvegarde. Compilation uniquement : aucun test ni lancement d’émulateur.

## 1.0.2

- Ryujinx et Citron : lecture directe par GDB, sur le port saisi dans Connect.
- Dans chaque émulateur, activer le serveur GDB avant de lancer le jeu. Dans Connect → Réglages → Serveur GDB, renseigner exactement le port configuré et cliquer sur « Enregistrer et reconnecter ». Aucun port n’est deviné ; un champ vide désactive cette connexion.
- Utiliser des ports distincts si les deux émulateurs tournent ensemble. Fermer les autres clients GDB.
- La connexion reste ouverte entre les lectures. Les changements de slots continuent d’être validés par l’identité des Pokémon ; une lecture temporairement invalide conserve la dernière équipe.
- Messages distincts pour un port fermé, déjà utilisé, appartenant à un autre processus ou ne répondant pas au protocole attendu.
- Citron est repris une seule fois après sa pause initiale. Les lectures GDB ne nécessitent plus Fastmem. Connect n’écrit pas dans la mémoire du jeu.
- Direct Switch toujours expérimental, dépendant des versions de jeu listées ci-dessous. Aucun test ni validation en jeu effectué ; sauvegarde disponible en repli.

## 1.0.1 (historique — configuration remplacée en 1.0.2)

- Nouveau logo PokeStream dans l’interface et l’icône Windows.
- Citron / Citron NEO : détection du processus, localisation par GDB, lecture native persistante et recherche des sauvegardes normales/portables.
- Activer « Enable GDB Stub » dans Configurer > Débogage avant de lancer le jeu. Fastmem doit rester activé. Le port par défaut est 6543 ; les ports personnalisés du fichier qt-config.ini sont reconnus. Fermer les autres clients GDB.
- Connect reprend immédiatement le jeu après la pause initiale imposée par Citron. Il ne pose aucun point d’arrêt et ne suspend pas le jeu pour lire l’équipe. La connexion reste ouverte tant que le jeu tourne.
- Ryujinx : mode SoftwarePageTable ajouté ; une interruption mémoire temporaire conserve la liaison pendant 15 secondes avant une nouvelle localisation.
- Écarlate/Violet : chaque emplacement suit son propre pointeur de statistiques, y compris après réorganisation de l’équipe.
- Épée/Bouclier : fusion des PV de combat corrigée quand un œuf est présent dans l’équipe.
- Direct Switch toujours expérimental : pas de lecture des types randomisés ni de garantie sur les transformations temporaires de combat. Aucune validation en jeu et aucun test exécuté.

## 1.0.0

- Ryujinx : identification par le jeu réellement chargé et sa version, même si le titre de fenêtre ne contient plus son nom (1.3.3). La liaison mémoire est conservée pendant les transitions d’équipe.
- Épée/Bouclier 1.3.2 : objets, sexe, formes, identité locale et lecteur des statistiques de combat. Les PV Dynamax peuvent dépasser 999. Les œufs ne sont pas pris pour des combattants.
- Écarlate/Violet : ajout du profil 4.0.0 ; reconstruction du Pokémon avec ses statistiques stockées séparément ; suivi continu des slots, objets, sexe, forme et PV lus. Aucun effet de combat n’est inventé à partir des données du catalogue.
- Catalogue d’objets 2G–9G et formes 8G/9G dans le site et l’application, avec sprites locaux. Les décorations de Charmilly et les changements de type Switch en combat ne sont pas encore lus.
- mGBA : objet, sexe et formes GB/GBA disponibles selon le format ; les transitions GBA gardent la liaison mémoire. RO/SA : table de slots ordonnée, profils 1.0 et 1.4.
- Types randomisés DS/X/Y/Alola : le premier type confirmé dans le jeu pour un Pokémon et sa forme est mémorisé hors combat et après redémarrage. Avant cette première observation, le type du catalogue reste le repli. Les types suivants lus en combat restent visibles sans écraser le type mémorisé. Une évolution ou forme inconnue doit être observée à nouveau.
- Mémoire locale des types : observed-types.json dans le dossier de données de Connect. Rechercher à nouveau réinitialise les observations du jeu sélectionné, à utiliser après un changement de randomisation. Si Connect découvre un Pokémon alors qu’un effet temporaire modifie déjà son type, relancer la recherche une fois cet effet terminé.
- Diagnostics : motif d’indisponibilité Ryujinx et version du jeu détectée.

### Lecture Switch expérimentale

Les lecteurs Switch modifiés restent à valider en jeu. Écarlate/Violet : les statistiques d’équipe sont lues en continu, mais le suivi des copies de combat, des transformations temporaires et de la téracristallisation n’est pas garanti. Les badges Switch utilisent le repli sur sauvegarde lorsque disponible ; Épée/Bouclier garde les badges manuels. Let’s Go reste en lecture de sauvegarde. RO/SA ne dispose pas encore de lecteur de copie de combat. Le suivi Nuzlocke automatique exige une identité individuelle (3G+).

Cette version utilise le catalogue d’objets et de formes actualisé du site. La migration connect_dynamax_hp porte la limite des PV à 2047 pour le Dynamax.


English and French interface. Connect follows the Windows UI language on first launch and falls back to English. Change it in Settings → Language; your choice is saved on this PC.

## 0.4.1.3

- Types lus en combat : Pokémon actifs en 4G, équipe de combat en 5G, X/Y et S/L–US/UL. Les types modifiés par le jeu sont envoyés à l’overlay.
- Hors combat, depuis une sauvegarde ou si la lecture est indisponible : types habituels de l’espèce/forme. Les changements temporaires de type ne sont pas conservés hors combat. Les œufs restent masqués.
- Game types are read during battle: active Gen IV Pokémon, the battle party in Gen V, X/Y and S/M–US/UM. Outside battle or when unavailable, the overlay falls back to species/form types.
- Compilation uniquement, aucun test ni lancement de l’application.

## 0.4.1.2

- Aide Azahar : Émulation > Configurer > Général > Débogage > Divers > Activer le serveur RPC.
- À activer avant de lancer le jeu. La détection d’une sauvegarde ne confirme pas la liaison en direct.
- Compilation uniquement, sans tests ni lancement de l’application.

## 0.4.1.1

- Correctif des listes déroulantes : la sélection affiche son libellé, sans représentation interne de l’objet (identifiant, jeu, propriétés).
- Le modèle partagé respecte les libellés des overlays, émulateurs et sauvegardes, ainsi que les drapeaux de langue.
- Compilation uniquement, sans tests ni lancement de l’application.

## 0.4.1

- Azahar : détection automatique, lecture 3DS partagée avec Citra et repli sur sauvegarde.
- X/Y, RO/SA, Soleil/Lune et Ultra-Soleil/Ultra-Lune utilisent les mêmes profils mémoire que Citra : équipe, objets, sexe, formes, PV et ordre des emplacements selon le jeu/profil.
- Serveur RPC à activer avant de lancer le jeu. Lecture uniquement sur le port local 45987, avec contrôle du processus propriétaire.
- Sauvegardes : dossier Windows Azahar ou dossier portable user/sdmc. Un emplacement personnalisé reste sélectionnable dans Réglages.
- Version compilée sans tests ni validation en jeu, conformément à la demande.

## 0.4.0

- Associate the application with your account once. Select or switch its Studio overlay directly in the Overlay card.
- Existing associations are preserved. Refresh the list after creating an overlay; destinations used by another device cannot be selected.
- Switching preserves the former overlay’s last team and loads the selected overlay’s separate local Nuzlocke journal.
- In-flight updates carry a selection revision. A delayed update cannot overwrite the new destination; a network timeout suspends sending until selection is confirmed.
- Source review and compilation only; no tests or emulator sessions were run for this release.

## 0.3.9

- Citra: Sun/Moon and Ultra Sun/Ultra Moon follow the party slot pointers, including reordered teams.
- Live battle HP and held items are matched to each Pokémon by identity. Gen VII forms, gender, items and sprites are mapped in Connect and Studio.
- Alola battle phase checks, double captures and identity checks reject incomplete transitions. Existing session retention and save fallback remain available.
- Save fallback now includes Gen VII held items. Eggs remain anonymous.
- Builds only; no automated tests or emulator sessions were run. Battle layouts remain experimental and need in-game validation on your revision.

## 0.3.8

- English/French catalogs, persistent language choice and localized game, Pokémon and item names.
- Legible headings on dark backgrounds.
- Vector window controls with explicit click targets.
- Material Symbols gender icons, no icon font required.
- The latest team and badge count stay visible while a reading is delayed.

## Compilation

Built with publish.ps1 -SkipTests. No application, emulator, visual or automated tests were run for this release.


Windows 10/11 x64. Associer son aventure, ouvrir son jeu, garder Connect lancé.
Un seul exécutable ; .NET et le lecteur de sauvegardes sont inclus.

## Compatibilité

| Jeux | Lecture directe | Repli sur sauvegarde |
|---|---|---|
| Rouge/Bleu/Jaune, Or/Argent/Cristal | mGBA, ROMs anglaises identifiées | .sav |
| Rubis/Saphir/Émeraude, Rouge Feu/Vert Feuille | mGBA, profils EN et RF/VF FR | .sav |
| Diamant/Perle/Platine, HG/SS, Noir/Blanc/2 | melonDS, DeSmuME, FR/EN | .sav, .dsv |
| X/Y, RO/SA, Soleil/Lune/Ultra | Citra / Azahar, serveur RPC existant, validation en jeu à terminer | main, recherche automatique |
| Let’s Go | Pas de profil direct | main, Ryujinx |
| Épée/Bouclier 1.3.2, Arceus 1.1.1, DE/PS 1.3.0 | Ryujinx / Citron expérimental, validation en jeu à terminer | main, recherche automatique |
| Écarlate/Violet 1.0.1, 1.1.0, 1.2.0, 1.3.0, 1.3.2, 2.0.1, 3.0.0/1, 4.0.0 | Ryujinx / Citron expérimental, validation en jeu à terminer | main, recherche automatique |

Les autres révisions utilisent la sauvegarde si elle est reconnue. Z-A, les ROM hacks, les fichiers de sauvegarde instantanée de l’émulateur ne sont pas couverts par cette version. Les sauvegardes doivent être déchiffrées par l’émulateur ; aucune clé de console n’est lue.

Connect affiche Direct, Sauvegarde ou Dernière équipe conservée. Une sauvegarde plus ancienne ne remplace pas une équipe lue en direct. Plusieurs émulateurs ou sauvegardes : choisir sa partie. Le choix est mémorisé par émulateur et famille de jeux. Sauvegarder en jeu actualise le repli. Pause arrête les envois.

## Bêta 0.3.8

Refonte de l’application Windows :

- Interface noire et rouge, titre « PokeStream Connect », icône d’application et barre de fenêtre intégrées.
- Navigation Session / Réglages / Aide. État de lecture du jeu séparé de l’association au site et du dernier envoi confirmé.
- Six cartes d’équipe avec sprites locaux, surnom, sexe, niveau, objet tenu et barre de PV. Les œufs restent anonymes, les K.O. sont signalés. Les cartes sont actualisées sans reconstruire toute la grille.
- Sprites et données de présentation embarqués : aucun téléchargement pendant la lecture du jeu. Formes et variantes connues, remplacement par le sprite de base si nécessaire.
- Émulateur choisi mémorisé ; bouton de lancement puis accès aux réglages pendant une session. Dimensions de fenêtre et option « Toujours au premier plan » mémorisées.
- Correction et confirmation Nuzlocke dans des fenêtres communes à l’interface.
- Activité récente et diagnostic à copier, sans identifiant de compte, clé d’association, chemin local ni contenu de l’équipe.

Les lecteurs, protocoles et règles de synchronisation de la bêta 0.3.6 sont conservés. Cette version ne revendique aucune nouvelle compatibilité en jeu.

Compilation uniquement, sans lancement de l’application, test visuel, test automatique ou essai en jeu, à la demande de l’utilisateur.

### Organisation de l’interface

- src/Connect.Desktop/Resources/Theme.xaml : palette, contrôles et icône vectorielle.
- MainWindow.xaml : fenêtre, navigation et écrans.
- MainWindow.Presentation.cs : états affichés, préférences et cartes.
- MainWindow.Dialogs.cs : fenêtres de confirmation, compteur et licences.
- Views/TeamSlot.xaml : carte d’un emplacement.
- SpriteCatalog.cs, data/sprites.zip, data/presentation.json : illustrations locales et correspondances partagées avec le site.
- data/sprite-manifest.json : provenance et empreintes des illustrations.

## Bêta 0.3.6

Correctif de stabilité (build 0.3.6.1) : Citra regroupe quatre lectures RPC de 32 octets, accepte les réponses dans le désordre et conserve le canal lors d’un délai ponctuel. Les lectures de combat ont un budget séparé et ne font plus perdre une équipe normale valide. Le site distingue la présence de l’appareil des changements d’équipe ; la validation accepte les nouveaux champs.

Priorité : Diamant/Perle/Platine, HG/SS, Noir/Blanc et Noir 2/Blanc 2 sur melonDS/DeSmuME ; X/Y sur Citra.

- Objet tenu, sexe, forme, PV actuels et maximums transmis au site. Les formes/sprites indisponibles utilisent une illustration de remplacement.
- Lecture des équipes et statistiques de combat ; correspondance par PID et identifiant dresseur, ordre de l’équipe conservé. Aucun Pokémon adverse n’est envoyé.
- Compteur K.O. et grisé de l’overlay actualisés avec les PV. Un passage à zéro est confirmé sur deux captures ; les changements de PV ne font plus invalider systématiquement une lecture entière.
- Lecture locale toutes les 500 ms, hors durée de capture ; envois regroupés à une seconde au minimum. Une requête réseau lente ne bloque pas l’observation locale du compteur Nuzlocke.
- Les profils de combat restent expérimentaux : X/Y (dispositions X et X 1.5), DS FR/EN. Les offsets de combat DS sont dérivés des profils documentés, avec contrôle du statut de combat et de l’identité complète de l’équipe. Les révisions non concordantes restent sur la lecture habituelle.
- Une copie de combat inchangée ne remplace pas une nouvelle modification de l’équipe hors combat. Lors d’une association au milieu d’un combat, le suivi de cette copie s’active à son prochain changement si ses PV diffèrent déjà de la fiche habituelle.

Compilation uniquement. Aucun test ni essai en jeu exécuté, conformément à la demande de l’utilisateur.

## Bêta 0.3.5

- La liaison au processus et au profil du jeu est conservée. Connect ne relance pas la détection des émulateurs pendant une session ouverte. « Rechercher un jeu » permet une recherche manuelle, notamment après un changement de version dans le même émulateur.
- Les changements d’équipe conservent la dernière lecture pendant la transition. Le compteur Nuzlocke ignore cet état temporaire. Les doubles lectures comparent les données utiles, avec contrôle de l’ordre et du checksum.
- DS : prise en charge des structures temporairement déchiffrées dans les menus. X/Y : les pointeurs d’emplacement peuvent bouger hors de leur pool initial.
- Le repli sur sauvegarde ne bloque plus les lectures en direct. Après le premier repérage, aucun nouveau parcours des sauvegardes tant que le direct fonctionne ; le fichier choisi reste surveillé.
- Site : tailles indépendantes de l’équipe, des badges et du compteur ; cadrage automatique dans la source OBS et les aperçus.

Compilation uniquement. Aucun test ni essai en jeu exécuté pour cette version, à la demande de l’utilisateur.

## Validation des versions précédentes

Les changements des bêtas 3 et 4 restent à valider en jeu par l’utilisateur. La bêta 4 suit la table des emplacements de X/Y et ajoute les badges directs DS. Compilation uniquement, sans exécution de tests à sa demande.


- 167 contrôles DS/Lua existants et 100 900 contrôles sauvegardes/décodeurs, comprenant 23 sauvegardes synthétiques et toutes les permutations de chiffrement.
- mGBA 0.10.5 : processus réel et ROM homebrew originale, détection automatique, espèce/surnom/niveau/PV vérifiés.
- melonDS 0.9.5/1.1 et DeSmuME 0.9.11/0.9.13 : processus réels vérifiés dans la version 0.2.
- Citra : protocole RPC loopback, contrôle du propriétaire du port et décodage vérifiés avec un serveur de test original.
- Ryujinx : localisation par snapshot CLR et lecture des pages vérifiées dans un processus de test avec une équipe synthétique. Ce test ne remplace pas la validation sur un jeu commercial ouvert.
- Sauvegardes réelles RO/SA, Épée, Arceus, Écarlate lues sans modification. Aucune sauvegarde utilisateur distribuée.

## Données

Lecture seule. Aucune injection ni écriture dans l’émulateur. Ryujinx utilise ponctuellement un snapshot Windows pour localiser sa mémoire ; la capture peut suspendre brièvement le processus. Cette opération est isolée dans un sous-processus avec délai maximal. Ensuite, seules les pages nécessaires à l’équipe sont lues.

L’équipe affichée, les badges obtenus et le total des morts sont envoyés au site. Aucune ROM, sauvegarde, clé, adresse mémoire ni PID n’est envoyé. Association chiffrée par Windows ; révocation depuis Connect sur le site. Les jeux DS, X/Y, Soleil/Lune et Ultra-Soleil/Ultra-Lune transmettent aussi l’objet tenu, le sexe, la forme et les PV. Les œufs sont anonymisés avant l’envoi.

## Nuzlocke et badges

Activer le mode Nuzlocke dans le studio. Connect compte chaque Pokémon K.O. une seule fois grâce à son PID, dès la première lecture disponible. L’historique est enregistré par aventure dans %LOCALAPPDATA%/PokeStream Connect/nuzlocke. Il survit aux redémarrages ; conserver ce dossier pour garder l’historique en changeant de PC. Un fichier illisible interrompt le suivi, sans effacement automatique.

- Générations 3–9 : suivi automatique lorsque le lecteur dispose du PID. Les œufs sont exclus.
- Générations 1–2 : pas de PID dans ces jeux ; utiliser « Corriger le compteur » dans Connect.
- Une correction conserve les identifiants déjà comptés. « Réinitialiser le suivi Nuzlocke » les efface après confirmation et remet le total à zéro, même sans émulateur ouvert. La synchronisation passe en pause ; les Pokémon encore K.O. seront recomptés à la reprise.
- L’état K.O. et son affichage grisé restent indépendants du compteur. Remettre le compteur à zéro ne soigne pas les Pokémon.
- Badges directs DS : Diamant/Perle/Platine, HeartGold/SoulSilver, Noir/Blanc et Noir 2/Blanc 2, profils FR/EN, avec melonDS ou DeSmuME. Les huit badges de Johto sont suivis dans HG/SS. Une lecture indisponible conserve le repli sur sauvegarde.
- Badges directs mGBA : ROMs GB anglaises identifiées, Rubis/Saphir/Émeraude EN, Rouge Feu/Vert Feuille EN, Rouge Feu FR révision 0. Autres profils : sauvegarde.
- Badges par sauvegarde : 1G–6G, Let’s Go, Diamant Étincelant/Perle Scintillante, Écarlate/Violet. Les 18 badges de Paldea sont indépendants (arènes, dominants, Team Star). Le site affiche uniquement les huit badges de Johto.
- Épée/Bouclier : badges manuels, faute de correspondance validée des flags individuels. Alola et Hisui n’ont pas de badges dans le catalogue actuel.
- Pour les badges par sauvegarde, choisir le fichier si Connect ne le trouve pas. En lecture directe, une sauvegarde doit partager au moins un PID avec l’équipe actuelle pour fournir les badges. L’équipe directe reste prioritaire.

Les envois et écritures de l’état d’affichage se font uniquement lorsque celui-ci change. Une vérification d’association et d’accès est effectuée régulièrement sans réécrire l’équipe.

## Citra et Azahar

**Azahar — lecture en direct :** Émulation > Configurer > Général > Débogage > Divers > Activer le serveur RPC. Active cette option avant de lancer le jeu.

**Azahar — live reading:** Emulation > Configure > General > Debug > Miscellaneous > Enable RPC server. Enable this option before starting the game.

X/Y : l’ordre suit les pointeurs des emplacements du jeu, y compris après un échange dans l’équipe. Les dispositions mémoire historiques et 1.5 sont reconnues par leur table et leur contenu. Une table modifiée pendant la lecture est ignorée jusqu’à la prochaine lecture stable.

Le serveur RPC doit être activé dans Citra ou Azahar avant le lancement du jeu. Connect reste en lecture seule sur le port local 45987 et vérifie qu’il appartient à l’émulateur choisi. Il conserve le profil du jeu, ignore les anciennes réponses UDP, réessaie les lectures interrompues et recrée sa connexion après une coupure. Pendant une interruption, la dernière équipe reste affichée et le repli sur une sauvegarde plus récente reste possible. Les mises à jour et ROM hacks non reconnus peuvent nécessiter le mode sauvegarde.

## Développement

SDK .NET 8+, PowerShell, Windows x64. Exécuter ./publish.ps1 pour les tests, le binaire autonome et l’archive des sources du lecteur GPL. Ajouter -SkipTests pour compiler sans exécuter les tests. Ajouter -CopyToWebsite pour préparer les fichiers du site, sans publication réseau. Le téléchargement upstream est fixé par commit et SHA-256.

Les sondes tests/Connect.Probe acceptent un PID d’émulateur. tests/Connect.RyujinxFixture contient un faux processus de test, pas un émulateur. Les fixtures et ROMs de test sont originales.

Voir SOURCES.md et THIRD-PARTY-NOTICES.md.
