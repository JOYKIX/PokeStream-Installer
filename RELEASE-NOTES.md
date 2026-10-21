PokeStream 2.2.2

- Fixed local profile creation and editing: same-origin checks now use the browser-facing loopback authority instead of Next.js's internal rewritten URL. The fix applies to local saves throughout the application.
- Profile errors now distinguish rejected requests, invalid inputs and unavailable local storage.
- Desktop and Start menu shortcuts open a persistent installed launcher. The portable bootstrap is extracted only when installing or updating, not on every normal launch.
- The launcher preloads the local server and profile screen. Connect starts in parallel when opening the workspace.
- Updates install a new desktop version before switching shortcuts; existing profiles and creations are preserved.
- Built locally before publication. SHA256 checksums and corresponding SaveReader sources are included.

Download **PokeStream-Setup.exe**, close the previous PokeStream instance, open the setup and select Install. Use the updated Desktop or Start menu shortcut for subsequent launches.

Switch live reading remains experimental.
