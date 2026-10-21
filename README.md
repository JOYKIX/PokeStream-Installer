# PokeStream

Free, local, open source Windows application: Adventure, Connect, Theme Creator and Overlay Builder.

## Install

Download [PokeStream-Setup.exe](https://github.com/JOYKIX/PokeStream-Installer/releases/latest/download/PokeStream-Setup.exe), run it and install PokeStream. Node.js and .NET are included; no account or administrator privileges are required.

**PokeStream Launcher 1.0.0** and **PokeStream 2.2.7** are separate installed programs with separate windows, native executables and shortcuts. The launcher handles installation, app updates, release notes, launch, repair and uninstallation. The app hosts the workspace and local game reader. Closing the launcher does not close a running app.

App updates keep the launcher open. If the app is running, it closes gracefully before replacement and reopens after completion. The launcher shows progress, validates SHA256 and waits for the installer result. Its own version is checked separately; it restarts only when its own files need updating.

The launcher supports English, French, Japanese, Spanish and German. System language is detected; manual changes persist and are shared with the app. Release notes for the installed version are bundled for offline use, with available update notes fetched from GitHub.

**Upgrading from 2.2.6 or earlier:** close the old app and run the new setup once. The old broken updater cannot repair its own handoff. Existing profiles, creations and sprites are preserved.

## Local files

- Profiles, creations, images, browser state and logs: %LOCALAPPDATA%/PokeStream/Studio
- App executable and runtime: %LOCALAPPDATA%/PokeStream/Application
- Launcher executable and browser state: %LOCALAPPDATA%/PokeStream/Launcher
- Downloaded updates: %LOCALAPPDATA%/PokeStream/Updates
- Maintenance logs and latest result: %LOCALAPPDATA%/PokeStream/maintenance.log and maintenance.json

OBS reads http://127.0.0.1:47653 while the app is running. Only the app starts the local server and Connect engine. The launcher does not run them in the background. Connect preferences and Nuzlocke journals stay under Studio/Connect. Switch live reading remains experimental.

Repair uses the installed app's bundled files, preserving its version and user data. Uninstall removes the app and retains the launcher. Keeping profiles, creations and sprites is selected by default. Deleting local data requires an explicit choice.

## Pokémon sprite library

The full [PokéAPI sprites](https://github.com/PokeAPI/sprites) catalog exceeds 10 GB. Used sprites are downloaded once and cached under Studio/Sprites. Downloads take priority over bundled images, and remain available after updates and repairs.

Open the launcher's **Sprite library** button, select a local profile if needed, then use **Settings → Pokémon sprite library → Download all sprites**. The operation supports pause and resume. The launcher displays disk-space information and opens the download section directly.

Adventure, Theme Creator and Overlay Builder share a visual picker with search, generation filters and Pikachu previews. All 50 Pokémon sprite families are available, with PNG/APNG, GIF, SVG and WebP support. The installer includes base graphics, badge images, a complete catalog index and 243 Pikachu preview variants. Pokémon, items, types and badges are included in the optional full download.

## Build

Requirements: Windows, Node.js 24+, .NET SDK 8+ and Git.

~~~powershell
npm ci
npm run desktop:pack
~~~

Output: .artifacts/release/PokeStream-2.2.7-win-x64.exe. The setup installs both programs; app updates do not replace an unchanged launcher. Regular shortcuts start installed native executables without unpacking a portable archive again.

Versions are declared in package.json: version for the app, launcherVersion for the launcher. Bundled release notes are in desktop/app/release-notes.json and must match both versions.

For development: npm run dev:desktop. Build Connect first for game reading.

## Publish

The public application repository is JOYKIX/PokeStream-Installer. Commit source, compile locally with npm run desktop:pack, push main, then run npm run desktop:publish. The publisher verifies the source commit and versions, uploads that exact binary, source archive, build-info.json and SHA256 checksums, then removes older published releases and their version tags. Commit history is retained. Pass -KeepOldReleases to scripts/publish-release.ps1 to preserve previous releases.

A manually dispatched Windows Release workflow is also available. See DEPLOIEMENT.md. The download website is the separate repository JOYKIX/pokestream, branch desktop-local, deployed on Vercel.

## Maintenance implementation

Maintenance workers run from independent native Windows processes in temporary directories, outside both installed programs. A two-step acknowledgement/commit prevents an abandoned worker from mutating files later. The launcher remains open and receives a per-operation completion record. Uninstallation validates every owned target and rejects reparse points before removing anything.

The workspace exposes an authenticated local named pipe for focus, language changes and graceful shutdown. No emulator process is terminated. App, launcher and installer use distinct Electron user-data locations.

## License

Original PokeStream code is MIT. See LICENSE, OPEN-SOURCE-NOTICES.md and desktop/connect/THIRD-PARTY-NOTICES.md. Pokémon artwork and sprites are not covered by this project's MIT license. Releases include corresponding source for the separate GPL SaveReader tool.
