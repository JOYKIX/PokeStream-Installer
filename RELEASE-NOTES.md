PokeStream 2.2.5 — maintenance reliability

- Fixed update and uninstallation handoff: a detached Windows helper acknowledges startup before long verification and post-exit cleanup.
- Replaced the generic "Maintenance could not start" message with persistent PowerShell bootstrap diagnostics and specific startup errors.
- Window is not hidden while the updated PokeStream starts, preventing invisible first launch.
- Update helper checks verified checksums and both runtime and desktop install manifests before reporting success.
- Uninstaller safely handles application and updater directories, preserves local profiles by default, and explicitly refuses junction/symlink traversal.
- Failure messages are saved across restarts, then cleared once acknowledged.
- Added automated Windows maintenance smoke tests for uninstall (keep/remove local data) and rejected update integrity.

The updater defect affects the **already installed 2.2.4 binary**: for the first repair install PokeStream-Setup.exe from the official v2.2.5 release. Local profiles, creations, sprites, journals and OBS configurations are preserved.

The previous full offline-first PokéAPI sprite library remains available under Settings.

Windows maintenance regression suite: 5/5 checks passed (helper startup, uninstall with and without local profiles, rejected tampered EXE, verified update installer handoff).
