# Distribution PokeStream — dépôt public

Code et releases Windows: `https://github.com/JOYKIX/PokeStream-Installer` (`main`). Site privé Vercel: `https://github.com/JOYKIX/pokestream` (`desktop-local`). **Ne plus publier les releases Windows dans le dépôt privé**.

1. Publier le dossier `PokeStream-App` sur `JOYKIX/PokeStream-Installer:main` à l'aide du script `PUBLIER-TOUT.ps1` fourni dans l'archive complète.
2. Dans le dépôt public, vérifier `Settings > Actions > General > Workflow permissions`: `Read and write permissions` si requis; le workflow demande déjà `contents: write`.
3. Ouvrir `Actions > PokeStream — Windows Release > Run workflow` et sélectionner `main`.
4. Le workflow effectue `npm ci`, typecheck, build Next.js, build Connect, build NSIS et portable, SHA256, puis publie `v2.1.0` dans **les releases publiques**.
5. Site privé Vercel: configurer `Production Branch: desktop-local`, `Root Directory: ./`. Le bouton du site pointe vers `.../releases/latest/download/PokeStream-Setup.exe` (alias stable généré par le workflow).
6. Pour la mise à jour suivante, incrémenter la version dans `package.json` et `package-lock.json`, committer, pousser sur `main`, relancer le workflow. L'application contrôle les Releases de ce même dépôt public.

**Avant diffusion :** vérifier les licences des images Pokémon incluses, la signature Windows, et tester l'installation et la mise à jour sur une machine réelle. Le workflow n'a pas de certificat de signature par défaut : SmartScreen peut afficher un avertissement.
