# PokeStream

Free, local, open source Windows application: Adventure, Connect, Theme Creator and Overlay Builder.

## Install

Download [PokeStream-Setup.exe](https://github.com/JOYKIX/PokeStream-Installer/releases/latest/download/PokeStream-Setup.exe), open it and select **Install**. The custom launcher installs the bundled application on your PC, creates shortcuts and manages opening, updates and repair. Node.js and .NET are included; no account or administrator privileges are required.

The launcher supports English, French, Japanese, Spanish and German. It detects the system language and remembers manual changes. Updates are optional, show progress and are checked with SHA256 before installation. You can open an installed version offline. Repair replaces application files and preserves profiles.

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

Output: .artifacts/release/PokeStream-2.2.1-win-x64.exe. The build prepares a complete standalone Next.js runtime, the .NET engine, the custom Electron launcher and a verified runtime ZIP. The runtime is isolated from electron-builder file filtering so its node_modules remain intact.

For development: npm run dev:desktop. This starts the shared Next.js UI and launcher; building Connect first enables the game reader.

## Publish

The public application repository is JOYKIX/PokeStream-Installer. Windows Release builds on main, and publishes when dispatched manually or when the commit contains [release]. Increment version in package.json and package-lock.json before a release. See DEPLOIEMENT.md.

The download website is a separate private repository, JOYKIX/pokestream, branch desktop-local, deployed on Vercel.

## License

Original PokeStream code is MIT. See LICENSE, OPEN-SOURCE-NOTICES.md and desktop/connect/THIRD-PARTY-NOTICES.md for third-party code and assets. Pokémon artwork and sprites are not covered by this project's MIT license. The release includes corresponding source for the separate GPL SaveReader tool.
