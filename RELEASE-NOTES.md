PokeStream 2.2.4

- Rebuilt the sprite availability catalog from the complete PokéAPI sprite index at packaging time, including named forms and shiny, female, back, and historical-generation variants.
- Adventure/Studio/OBS now resolve Pokémon graphics through the local PokeStream sprite library instead of requiring GitHub image URLs on every display.
- Missing sprites are fetched from PokéAPI once and cached in persistent local user data, surviving app updates and repairs.
- The base Connect sprites are extracted into the packaged standalone web runtime for offline use without a first download.
- Added the resumable full-library downloader to local Settings. A full mirror is optional due to the upstream repository size (over 10 GB); download progress and pause controls are included.
- Preserved the five languages and existing Connect integration. No changes to emulator memory readers.
- Installation preserves your existing profiles, saves, creations and cached images.

The full PokéAPI artwork cannot reasonably be bundled in the single-file installer. Automatic per-sprite caching works immediately; offline use of *every* upstream graphic requires completing the optional full-library download first.

Pokémon graphic copyrights remain with their respective rights holders. PokeStream is unofficial.
