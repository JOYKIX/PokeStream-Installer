PokeStream 2.2.7 · Launcher 1.0.0

## Launcher
- PokeStream Launcher and the PokeStream application now have separate executable files, processes, windows, shortcuts and installation manifests.
- App updates keep the launcher open. The launcher closes only the app when required, shows installation progress and reopens it if it was running.
- The launcher has its own version: 1.0.0. App and launcher versions are checked independently; the launcher is replaced only when its version changes.
- New compact interface with built-in release notes in English, French, Spanish, German and Japanese. Available update notes are also retrieved from GitHub.
- Added sprite-library guidance, disk-space information and a direct link to the resumable download screen.

## Maintenance fixes
- Replaced the unreliable Windows process handoff. The independent native maintenance worker survives its initiating process and reports the actual result.
- Installation validates paths and SHA256 before starting, requires an explicit commit and records completion only after the installer finishes writing both application manifests.
- Repair uses the installed app's own bundled files, without downgrading it to the launcher's original app version.
- Uninstall removes the app while keeping the launcher installed. Profiles, creations and downloaded sprites are preserved by default; deletion requires an explicit choice.
- Local maintenance diagnostics used disposable directories only. No user installation or game data was modified, and no emulator test suite was run.

**Migration:** close the old PokeStream version, download **PokeStream-Setup.exe** and run it once. The old updater cannot repair itself. Local profiles, creations and downloaded sprites are preserved. Later app updates run inside the new launcher.

Switch live reading remains experimental.
