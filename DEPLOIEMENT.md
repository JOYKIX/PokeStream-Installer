# Publication locale

Application : JOYKIX/PokeStream-Installer, branche main (public).
Site : JOYKIX/pokestream, branche desktop-local (privé, Vercel).

1. Incrémenter package.json et package-lock.json, puis committer les sources.
2. Compiler localement avec npm run desktop:pack. Cette commande ne lance pas les tests.
3. Vérifier le résultat dans .artifacts/release et pousser les sources sur origin/main.
4. Lancer npm run desktop:publish. Le script utilise l’authentification Git existante, sans enregistrer de jeton dans les fichiers.
5. Le binaire local versionné, l’alias PokeStream-Setup.exe, les empreintes SHA256, les informations de compilation et les sources SaveReader sont téléversés dans une release brouillon.
6. Après vérification des fichiers, le script publie la release, la marque comme dernière version, puis supprime les anciennes releases publiées et leurs tags de version. L’historique des commits reste disponible.

Les pushes ordinaires ne lancent plus de compilation Windows distante. Le workflow Windows Release reste disponible manuellement si une compilation GitHub est souhaitée.

Le site de téléchargement utilise toujours l’alias public stable ; il n’a pas besoin d’un redéploiement pour chaque nouvelle version de l’application.

Les raccourcis Windows ciblent directement le launcher installé. Les fichiers du programme et les données utilisateurs restent séparés. La préparation du serveur commence dans le launcher pour réduire le temps d’ouverture de l’espace de travail.
