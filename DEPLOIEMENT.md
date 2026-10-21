# Publication

Application : JOYKIX/PokeStream-Installer, branche main (public).
Site de téléchargement : JOYKIX/pokestream, branche desktop-local (privé, Vercel).

1. Incrémenter la version dans package.json et package-lock.json.
2. Compiler avec npm run desktop:pack. Aucun test n’est lancé par cette commande.
3. Publier sur main avec [release] dans le message, ou lancer Windows Release manuellement.
4. Le workflow publie le launcher versionné, son alias stable PokeStream-Setup.exe, les empreintes SHA256 et les sources du lecteur de sauvegardes.
5. Publier le site séparément sur desktop-local. Le bouton de téléchargement pointe sur l’alias public stable.

À partir de 2.2, le fichier de téléchargement ouvre le launcher PokeStream personnalisé. Il assure lui-même l’installation locale, la réparation et les mises à jour. Aucun assistant NSIS n’est utilisé.

L’installateur sépare les fichiers de l’application et les données. Les mises à jour ne remplacent pas les profils, thèmes ou compositions.
