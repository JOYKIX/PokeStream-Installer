# PokeStream — Windows application

**Free · Local · Open source**

PokeStream includes Adventure, Connect, Theme Creator and Overlay Builder. The desktop application uses Electron, a local Next.js server, SQLite and the Connect .NET engine. OBS reads the local overlay source.

- **Application, installer, updates, releases:** this public repository, [`JOYKIX/PokeStream-Installer`](https://github.com/JOYKIX/PokeStream-Installer).
- **Website:** [PokeStream](https://github.com/JOYKIX/pokestream) — separate **private** repository, deployed to Vercel. This public repository contains no website landing page.
- **License:** MIT for original project code. Third-party resources may have different rights; read `OPEN-SOURCE-NOTICES.md` and `desktop/connect/THIRD-PARTY-NOTICES.md`.

## Windows build

Prerequisites: Node.js 24, .NET SDK 8, Git and internet access for first-time dependencies/sprite preparation.

```powershell
npm ci
npm run typecheck
powershell.exe -ExecutionPolicy Bypass -File .\CONSTRUIRE-APP.ps1
```

Packages appear in `.artifacts/release/`:

- `PokeStream-Setup-X.Y.Z-win-x64.exe`: installer (NSIS)
- `PokeStream-X.Y.Z-win-x64.exe`: portable edition

Use **Actions → PokeStream — Windows Release → Run workflow** on `main` to publish the public GitHub Release and the stable `PokeStream-Setup.exe` download alias. Increase `version` in `package.json` **and** `package-lock.json` before each new release.

An installed application checks the [public GitHub Releases](https://github.com/JOYKIX/PokeStream-Installer/releases) for updates. It downloads the new installer only with user confirmation and checks its SHA-256 before launching it after application shutdown. Offline usage does not require GitHub.

## Development

```powershell
npm ci
powershell.exe -ExecutionPolicy Bypass -File .\DEMARRER-APP.ps1
```

## Local data

Profiles, configurations and user-created files remain in `%LOCALAPPDATA%\PokeStream\Studio`, separate from the installation directory. Make a backup before migrating beta versions.

## Contributing

You can modify the source, suggest fixes, create forks and distribute alternate versions under the terms of the MIT license. Please label unofficial variants clearly when possible. No project-imposed contribution bureaucracy.

## Important

PokeStream is an independent fan project, not affiliated with Nintendo or The Pokémon Company. **Pokémon sprites, badges and artwork are not covered by the MIT license.** Audit the distribution rights of bundled third-party assets and code before a public binary release.

The Windows Connect engine cannot be compiled on Linux. A successful CI build does not replace testing the installer, Connect, OBS, updates, and persistence on a real Windows machine.
