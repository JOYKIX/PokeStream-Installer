# PokeStream

Free, local, open source Windows application: Adventure, Connect, Theme Creator and Overlay Builder.

## Install

Download [PokeStream-Setup.exe](https://github.com/JOYKIX/PokeStream-Installer/releases/latest/download/PokeStream-Setup.exe), open it and select **Install**. The custom launcher installs the bundled application on your PC, creates shortcuts to the installed native launcher and manages opening, updates and repair. The bootstrap is extracted once during installation; regular launches do not unpack the portable EXE again. Node.js and .NET are included; no account or administrator privileges are required.

The launcher supports English, French, Japanese, Spanish and German. It detects the system language and remembers manual changes. Updates are optional, show progress and are checked with SHA256 before installation. You can open an installed version offline. Repair replaces application files and preserves profiles. Uninstall is available in the launcher, with an explicit choice to keep or delete local profiles and creations. Completed update downloads are restored after restarting the launcher. The launcher and workspace share the same language preference.

## Local files

- Profiles, creations, images and logs: %LOCALAPPDATA%/PokeStream/Studio
- Application and runtime: %LOCALAPPDATA%/PokeStream/Application
- Downloaded updates: %LOCALAPPDATA%/PokeStream/Updates

OBS reads the local server at http://127.0.0.1:47653 while PokeStream is running. Connect runs inside the application; its preferences and Nuzlocke journals are kept under Studio/Connect. Switch live reading is experimental.

## Build

Requirements for contributors: Windows, Node.js 24+, .NET SDK 8+ and Git.

~~~powershell
npm ci
npm run desktop:pack
~~~

Output: .artifacts/release/PokeStream-2.2.5-win-x64.exe. The build prepares a complete standalone Next.js runtime, the .NET engine, the custom Electron launcher and a verified runtime ZIP. The runtime is isolated from electron-builder file filtering so its node_modules remain intact.

For development: npm run dev:desktop. This starts the shared Next.js UI and launcher; building Connect first enables the game reader.

## Publish

The public application repository is JOYKIX/PokeStream-Installer. Commit the source, compile locally with npm run desktop:pack, push main, then run npm run desktop:publish. The script uploads exactly that local binary, verifies the source commit and asset sizes, publishes the release and removes older published releases and their version tags. Add -KeepOldReleases when invoking scripts/publish-release.ps1 to preserve older releases. A manually dispatched Windows Release workflow remains available as a fallback. See DEPLOIEMENT.md.

The download website is a separate private repository, JOYKIX/pokestream, branch desktop-local, deployed on Vercel.

## License

Original PokeStream code is MIT. See LICENSE, OPEN-SOURCE-NOTICES.md and desktop/connect/THIRD-PARTY-NOTICES.md for third-party code and assets. Pokémon artwork and sprites are not covered by this project's MIT license. The release includes corresponding source for the separate GPL SaveReader tool.

## Pokémon sprite library (2.2.4)

The full [PokéAPI sprites](https://github.com/PokeAPI/sprites) catalog exceeds 10 GB. To avoid making the Windows installer gigantic, PokeStream includes the original Connect base graphics and a complete file index. The local image service downloads missing Pokémon sprites once from PokéAPI and caches them persistently under `%LOCALAPPDATA%/PokeStream/Studio/Sprites/pokemon`. Studio, previews and OBS then reuse the cached images offline, even after upgrading or repairing the application. The latest upstream manifest refreshes the 39 graphic families and alternate-form directory index during `npm run desktop:build`.

To download **the entire library** ahead of offline use, open **Settings → Pokémon sprite library → Download all sprites**. The operation is resumable and can be paused. The full download requires significant bandwidth and free disk space; downloaded sprite files remain local and are not deleted during PokeStream updates. The installer does not bundle the complete third-party image repository. Files unavailable upstream fall back to the application's usual sprite-selection logic.


## Maintenance reliability (2.2.5)

Updates and uninstallation run from a detached PowerShell helper copied to a temporary directory outside the installed Application. Its startup is acknowledged immediately and failures are logged in `%LOCALAPPDATA%/PokeStream/maintenance-bootstrap.log` and `%LOCALAPPDATA%/PokeStream/maintenance.log`. Post-restart results appear in `maintenance.json` until read by the launcher.

**Important:** The broken handoff in 2.2.4 cannot be retroactively patched in an already running executable. Install the 2.2.5 setup from GitHub once, preserving your existing local profiles. The corrected in-app update mechanism then applies to subsequent releases. Default uninstallation keeps profiles and creations unless deletion is explicitly selected.
