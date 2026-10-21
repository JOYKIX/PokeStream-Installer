# Références techniques

Les décodeurs et lecteurs en direct sont des implémentations originales. Formats, constantes et organisation mémoire vérifiés dans :

- https://github.com/Real96/PokeLua — profils DS.
- https://github.com/kwsch/PKHeX/tree/b60c6e5f1427263260061d3f8c5540b924063572 — formats PK1–PK9/PA8, identifiants d’espèces, oracle de tests ; bibliothèque GPL utilisée uniquement par le convertisseur séparé et les tests GPL.
- https://github.com/TASEmulators/desmume et https://github.com/melonDS-emu/melonDS — RAM DS.
- https://github.com/mgba-emu/mgba/tree/0.10.5 — allocation ROM/WRAM/EWRAM/IWRAM.
- https://github.com/pret/pokered, https://github.com/pret/pokeyellow, https://github.com/pret/pokegold, https://github.com/pret/pokecrystal — empreintes des ROMs GB reconnues.
- https://github.com/EverOddish/Pokemon_Summary_Screen et https://github.com/kcblack42/Citra-Tracker-v2 — organisation des équipes Citra.
- https://github.com/azahar-emu/azahar — protocole RPC Citra, requêtes de lecture uniquement sur loopback.
- https://github.com/kotx/Ryujinx — KProcess, ProcessResult, MemoryManagerHostMapped/HostTracked, NativePageTable et disposition des images NSO.
- https://github.com/microsoft/clrmd — snapshot CLR Windows ; aucune exécution de code dans le processus cible.
- https://github.com/zaksabeast/CaptureSight — adresses des équipes Épée/Bouclier, Arceus et DE/PS.
- https://github.com/Manu098vm/SVResearches/blob/master/RAM%20Pointers/RAM%20Pointers.txt — adresses versionnées de l’équipe Écarlate/Violet.
- https://learn.microsoft.com/en-us/windows/win32/api/memoryapi/nf-memoryapi-readprocessmemory — lecture des processus Windows.
- https://github.com/PokeAPI/pokeapi — noms français des 1 025 espèces.

Les profils expérimentaux sont indiqués dans README.md ; une adresse documentée et un test synthétique ne constituent pas une validation sur toutes les versions d’un jeu.


## Automatisation (bêta 3)
- PID local : champs PID des structures PK3–PK9 ; l’encryption constant de PK6+ ne remplace pas le PID.
- Badges de sauvegarde : propriétés et flags du source PKHeX fixé ci-dessus. SAV1/2/3/4/5/6 utilisent un masque ; Let’s Go utilise les flags System 12–19 ; BDSP System 124–131 ; Paldea utilise les 18 clés WEVT_*_CLEAR (index d’acquisition -1 = absent, 0 = premier badge).
- Badges en mémoire : tables de symboles de https://github.com/pret/pokered/tree/symbols, https://github.com/pret/pokeyellow/tree/symbols, https://github.com/pret/pokegold/tree/symbols, https://github.com/pret/pokecrystal/tree/symbols.
- GBA : https://github.com/pret/pokeemerald/tree/symbols, https://github.com/pret/pokeruby/tree/symbols, https://github.com/pret/pokefirered/tree/symbols ; structures SaveBlock1 / constants/flags.h des mêmes projets.
- Rouge Feu FR : données d’adresses de https://github.com/besteon/Ironmon-Tracker/blob/main/ironmon_tracker/GameAddresses/Pokemon%20Rouge%20Feu.json (gSaveBlock1ptr 0x03004F58, badgeOffset 0xFE4). Lecture implémentée indépendamment.

## Emplacements X/Y et badges DS (bêta 4)

- X/Y : table de six pointeurs et nombre de Pokémon à +0x18, objets de 0x1E4 octets, corps à +0x40 et stats à +0x158 du corps. Référence : https://github.com/m4-used-rollout/pokemon-hud/blob/b8f7068324a0ab6a30205fbae3652988ed941d62/src-server/ram-reading/g6.ts (ParseParty, dispositions X et X 1.5). Implémentation originale : pointeurs uniques bornés aux plages de RAM 3DS, double capture des données et contrôle de la table avant/après.
- DS 4G : pointeurs de la fiche dresseur FR/EN et offsets du TID dans https://github.com/Real96/PokeLua/tree/b76caf669872897295db5304eebbdf5e53125efb/Gen%204/DeSmuMe ; masque de badges situé 10 octets après le TID selon PlayerProfile / TrainerInfo des projets pret/pokediamond, pret/pokeplatinum et pret/pokeheartgold. HG/SS : masque Johto uniquement, conformément au catalogue du site.
- DS 5G : masque individuel dans Misc5.Badges (money + 4), source PKHeX fixé ci-dessus. Adresses publiques de progression : https://www.pokemontrash.com/codes-pokemon/codes-noir-blanc-divers (pointeur 0x02000024, offset 0x21AC0), https://www.pokemontrash.com/codes-pokemon/codes-noir-2-blanc-2-deblocage (FR), https://gamefaqs.gamespot.com/boards/661226-pokemon-black-version-2/64261559 (EN). Seules les adresses sont utilisées pour lire les flags ; aucun code de triche ni écriture mémoire.
- Toutes les nouvelles lectures sont bornées et vérifiées pour stabilité ; une donnée indisponible reste null et ne supprime pas les badges. Ces profils n’ont pas été exécutés en jeu dans cette version, à la demande de l’utilisateur.

## Stabilité (bêta 0.3.5)

- DS : flags partyDecrypted / boxDecrypted, disposition des blocs et Enter/ExitDecryptionContext dans https://github.com/pret/pokeplatinum/blob/c248fb3f8cc9934ded800e489567c5c0eeee92eb/src/pokemon.c et include/struct_defs/pokemon.h. Les données conservent le contrôle du checksum ; une mutation incomplète est reportée.
- X/Y : ParseParty de pokemon-hud, référence ci-dessus, lit le nombre sur un octet à +0x18 et suit les pointeurs, sans imposer les six adresses physiques initiales. Seuls les pointeurs utilisés sont comparés entre deux captures, puis les champs décodés destinés à l’overlay.
- Aucun de ces changements n’a été exécuté en jeu dans cette version. Compilation sans tests à la demande de l’utilisateur.

## Données et combat (bêta 0.3.6)

- PK4/PK5 : objet +0x0A, sexe/formes +0x40 ; PK6 : objet +0x0A, sexe/formes +0x1D. Formats PKHeX au commit b60c6e5f1427263260061d3f8c5540b924063572, lecture réimplémentée indépendamment. PID et ID32 servent uniquement à la correspondance locale.
- DS : https://github.com/Brian0255/NDS-Ironmon-Tracker/tree/910c255566a200aa4a2d87e2d93107ed0aef7f74 (MemoryAddresses, BattleHandlerGen4/5). Statut 0x2100/0x2101, copies d’équipe 4G, table BtlParty 5G. Les déplacements FR/révisions sont des adaptations à partir des profils d’équipe PokeLua, pas des offsets validés en jeu : contrôle systématique de la phase et des identités, repli si non concordants.
- Mon actif 4G : https://github.com/pret/pokeplatinum/blob/c248fb3f8cc9934ded800e489567c5c0eeee92eb/include/battle/battle_mon.h (PID +0x68, ID32 +0x74, PV +0x4C/+0x50, objet +0x78, forme +0x26).
- X/Y : ParseBattle de https://github.com/m4-used-rollout/pokemon-hud/blob/b8f7068324a0ab6a30205fbae3652988ed941d62/src-server/ram-reading/g6.ts ; zone 0x081F0000–0x08210000, table à 0x081FB284. Lectures ciblées, pas de dump complet via RPC.
- Catalogue du site : https://github.com/PokeAPI/pokeapi/tree/6bbd96bb8ef7356963b833074ca25672d23e41c4/data/v2/csv ; item_game_indices, pokemon_forms, pokemon_form_generations, pokemon_types. FormConverter PKHeX sert de référence pour l’ordre des formes DS/X/Y (les game_index VI de PokeAPI sont incomplets). Sprites cosmétiques issus du catalogue PokeAPI déjà importé par le site.
- Aucun essai sur émulateur ni test automatisé pour cette version. Compilation et revue du code uniquement.

## Alola (bêta 0.3.9)

- Équipe US/UL : table 0x33F7F9B8, pointeurs +0x40, stats +0x158 du corps ; source https://github.com/m4-used-rollout/pokemon-hud/blob/b8f7068324a0ab6a30205fbae3652988ed941d62/src-server/ram-reading/g7.ts (ParseParty).
- Soleil/Lune : corps du premier objet 0x34195E10 documenté dans https://github.com/fa-dx/PKMN-NTR/blob/ee19fd2187e2cbd2d629eb635b9bdfd920dffb3a/PKMN-NTR/MainForm.cs. Table 0x34195D84 dérivée de la même disposition 7G (-0x8C) et validée par les pointeurs, le nombre et les checksums de chaque Pokémon. Aucune lecture séquentielle de secours qui puisse réordonner incorrectement une équipe.
- Combat US/UL : g7.ts, table de quatre participants à 0x30000404 ; structure de combat 0x330, pointeur direct vers un objet PK7 à +0x40, PV +0x10/+0x0E, objet +0x12, niveau +0x18. Marqueur de phase exact à 0x30002738. Les données PK7 sont relues pour suivre les formes.
- Combat S/L : https://github.com/AnalogMan151/sumoCheatMenu/blob/744895988b1d7b76296b6b301d90dfed51b2269f/Sources/helpers/helpers.c (isInBattle : 0x30000158 == 0x40001) et Sources/battle_modifiers.c (structure 0x330, PV +0x10/+0x0E). Table de participants adaptée de la structure 7G ; acceptée uniquement lorsque toute l’équipe correspond par PID, ID32, espèce et état œuf. Aucun code de triche ni écriture mémoire repris.
- Correspondances 7G : CSV PokeAPI au commit déjà fixé ; Pikachu à casquette utilise les indices PK7, les types de Silvalli suivent sa forme. Sauvegardes S/L et US/UL : HeldItem du PK7 via le convertisseur séparé. Sprites supplémentaires conservés au commit de data/sprite-manifest.json.
- Implémentation originale, compilation uniquement. Les tables adaptées et révisions de jeux n’ont pas été validées en émulation dans cette version.

## Azahar (0.4.1)

- https://github.com/azahar-emu/azahar/blob/master/src/citra_meta/CMakeLists.txt — exécutable Windows azahar.exe. Anciennes distributions azahar-qt également reconnues.
- https://github.com/azahar-emu/azahar/blob/master/src/common/common_paths.h et src/common/file_util.cpp — %APPDATA%/Azahar, ou user à côté du binaire.
- https://github.com/azahar-emu/azahar/blob/master/src/core/rpc/udp_server.cpp et src/core/rpc/packet.h — protocole RPC conservé, UDP 45987. Connect émet uniquement ReadMemory.
- https://github.com/azahar-emu/azahar/blob/master/src/citra_qt/configuration/configure_debug.cpp — RPC à activer avant le jeu. Aucun réglage de l’émulateur n’est modifié par Connect.

## Types lus dans le jeu (bêta 0.4.1.3)

- 4G : type1/type2 +0x24/+0x25 du BattleMon actif, source pret/pokeplatinum déjà fixée ci-dessus. Seuls les combattants du joueur dont PID, ID32 et espèce correspondent à l’équipe sont lus.
- 5G : https://github.com/totallyanon/swan/blob/5b2cbd695592115aa9af330ab4cfbeeb11ee6937/battle/battle_mon.h — BattleMonCore 0xEC, BattleMonBase.type1/type2 à +0x0C/+0x0D, soit +0xF8/+0xF9. Recoupement des offsets de stats +0xEE et stat_stages +0xFC avec NDS-Ironmon-Tracker. Le nombre de membres de BattleParty est lu sur un octet, sans confondre le champ numFieldPos suivant avec la taille d’équipe. Adaptation B/W et B2/W2 à la table BtlParty existante, non validée en émulation.
- 6G X/Y et 7G : paire +0x1E4/+0x1E5 dans g6.ts/g7.ts de pokemon-hud au commit déjà cité. Deux octets par Pokémon, dans le budget RPC existant.
- Identifiants de types : https://github.com/kwsch/PKHeX/blob/b60c6e5f1427263260061d3f8c5540b924063572/PKHeX.Core/Game/Enums/MoveType.cs ; la 4G conserve un emplacement inutilisé avant Feu. Déduplication des monotypes, refus des valeurs inconnues et confirmation sur deux captures.
- Lecture des types actuellement chargés en combat (donc aussi les changements temporaires). Les PK4–PK7 et leurs sauvegardes ne stockent pas le type d’espèce : hors combat, pour les membres 4G non actifs ou si les champs ne sont pas lisibles, le site utilise le catalogue de l’espèce/forme. Aucun cache de type de combat n’est réutilisé hors combat, pour ne pas conserver un effet temporaire (Détrempage, etc.) ni le transférer à une autre partie randomisée. Aucun type d’œuf n’est envoyé.
- Revue des sources et compilation uniquement, aucun test exécuté.


## Release 1.0.0

- Ryujinx 1.3.3 : https://github.com/Ryubing/Issues/issues/104 ; titre de fenêtre sans nom du jeu. Structures au commit 92ed01e99de8ebab4f23b39ef0135de8f19b8cf1 de https://github.com/jack-odwyer/ryufork (source 1.3.3) : KProcess.TitleId/Pid, ProcessResult.ProgramId/ProcessId/DisplayVersion, gestionnaires HostMapped/HostTracked. Identification en lecture seule ; aucune installation ni lancement de Ryujinx.
- Écarlate/Violet 4.0.0 et statistiques séparées : https://github.com/Eppin/Sysbot.NET/blob/691397ef163dd08c32cb69af1c4ce030ca2e2011/SysBot.Pokemon/SV/Vision/PokeDataOffsetsSV.cs et PokeRoutineExecutor9SV.cs, ReadRawPartyPokemon/ReadRawPartyStats. Corps 0x148 via objet +0x30 ; statistiques chiffrées 0x10 via premier objet +0x50 et indice *0x10. Les anciennes versions utilisent les profils documentés par https://github.com/Manu098vm/SVResearches/tree/253c44fb794743e1b423aa9a64118f66b3faac54. Implémentation indépendante, contrôle des identités et adresses sur deux captures. Ce profil 4.0.0 n’a pas été vérifié sur émulateur.
- Combat Épée/Bouclier 1.3.2 : https://github.com/samabenie1/pokemon-battle-assistant/blob/ed42d1f2f533ddfdda17d0b1b594e5711a0c3f58/src/sources/live.ts ; structure statut à heap+0x8FE9D5E0, stride 0x7A0, corps PK8 à +0x4E8, espèce/PV max/PV/objet/niveau à +0/+2/+4/+6/+12. Référence issue d’un autre émulateur ; son adresse physique, son scanner et ses écritures ne sont pas utilisés. Contrôle d’identité PID/ID32/espèce et double capture avant fusion. Marqueurs de phase 0x3F128624/626 du SysBot.NET officiel, commit 844c1f31face95bc8e1cfec9c9b7cbd9f7a62895. Profil non validé dans Ryujinx.
- Formes, genre, objets et données GB/GBA : formats PK2/PK3/G8PKM/PA8/PK9 et FormConverter PKHeX au commit déjà fixé. Ratios de genre factuels personal_c / personal_rs, offsets 0x0D/0x10, tailles 0x20/0x1C. Champs et décodage implémentés indépendamment ; aucun lecteur d’écriture.
- RO/SA, ordre des slots : https://github.com/Readek/Pokemon-Stream-Tool/tree/f15092a6b5887dffca58446cd1303527c8715e33/Stream%20Tool/Resources/Scripts/GUI/Emu%20Scripts/Citra/Memory%20Locations : Party Indexes et Party Pokemon, tables 0x08CF71F0 / 0x08CFB1E0 pour 1.0 / 1.4. Corps des objets +0x40, double capture avec checksum et validation du nombre/pointeurs. Aucun profil de combat RO/SA déduit de X/Y.
- Types hors combat : remplace la politique 0.4.1.3 ci-dessus. Mémoire bornée à 4096 identités génération/jeu/ID32/PID/espèce/forme ; uniquement les types observés dans une lecture du jeu, jamais le repli du catalogue. Première observation conservée pour ne pas écraser cette référence par les changements de type ultérieurs en combat. Les œufs sont exclus. Réinitialisation explicite à la recherche manuelle. Une observation initiale en plein effet temporaire reste une limite : un cache n’est pas une lecture de la table personal de la ROM randomisée.
- Catalogue Switch : CSV PokeAPI déjà épinglés. Les formes G-Max, méga, primales et dominantes ne sont pas confondues avec les indices de formes classiques. Cas Pikachu explicitement remappé ; les décorations de Charmilly restent hors protocole. Aucun test automatique, graphique ou en jeu exécuté.


## Switch et logos (1.0.1)

- Citron NEO : sources au commit 40212aa3ecbda5588e456b57f875311baf9213d8 de https://github.com/citron-neo/emulator : src/core/debugger/gdbstub.cpp (qRcmd get info/get fastmem), debugger.cpp (pause initiale à la connexion, Continue), src/common/settings.h (GDB 6543), src/common/fs/path_util.cpp (données normales/portables). Protocole réimplémenté, aucun code source Citron embarqué. Connexion exclusivement loopback avec vérification du propriétaire du port ; pas de lecture des clés ou ROMs, pas de commande d’écriture mémoire.
- Après Continue, les requêtes de métadonnées sont acceptées sans interrompre le jeu dans cette implémentation de Citron. Les Pokémon sont ensuite lus par ReadProcessMemory dans la plage fastmem déclarée. Les métadonnées sont rafraîchies toutes les cinq secondes, pas une nouvelle connexion/recherche d’équipe. Les variantes ne fournissant pas ces commandes restent en repli sauvegarde.
- Ryujinx SoftwarePageTable : https://github.com/jack-odwyer/ryufork/blob/92ed01e99de8ebab4f23b39ef0135de8f19b8cf1/src/Ryujinx.Cpu/Jit/MemoryManager.cs : _pageTable, PaToPte et masque des indicateurs hauts de page. Les PTE logiciels sont des adresses de début de page, contrairement aux entrées HostTracked biaisées par adresse virtuelle.
- SV : https://github.com/Manu098vm/SVResearches/blob/253c44fb794743e1b423aa9a64118f66b3faac54/RAM%20Pointers.txt : PartyStats via chaque objet de slot +0x50. Remplace l’hypothèse de contiguïté documentée en 1.0.0. Profils partageant le même offset regroupés dans Citron ; ce regroupement ne prétend pas identifier la version précise du jeu.
- Logos SVG originaux fournis par JOYKIX dans public/logo. Dérivés PNG/ICO produits pour les icônes natives et mobiles ; SVG originaux conservés.
- Compilation uniquement ; pas de test automatisé, graphique ou sur émulateur. Pas de nouveaux offsets de type ou de combat inventés.

## GDB commun (1.0.2)

- Ryujinx : jack-odwyer/ryufork, commit 92ed01e99de8ebab4f23b39ef0135de8f19b8cf1, src/Ryujinx.HLE/Debugger/Debugger.cs et HleProcessDebugger.cs : qSupported, qRcmd get info, m, c. Citron NEO : même révision que ci-dessus. Transport RSP réimplémenté : sommes de contrôle, acquittements, échappement, paquets console et taille maximale négociée.
- Le port saisi est contrôlé dans les tables TCP Windows (IPv4/IPv6) avant connexion loopback au processus sélectionné. Les adresses virtuelles renvoyées par get info sont lues via m ; aucune dépendance Fastmem ni CLR dans le chemin de lecture Switch de l’interface.
- Profils et modules contrôlés par signatures et double lecture des identités. Les erreurs de transport invalident la connexion ; les transitions de contenu conservent le profil. Compilation uniquement, sans tests ni émulateur lancé.
