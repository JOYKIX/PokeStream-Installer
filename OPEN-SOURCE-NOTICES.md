# PokeStream — Licensing and assets

The new PokeStream website and desktop app source is offered under MIT (see `LICENSE`),
**except** for independently licensed third-party components and resources.

- The separate SaveReader program and PKHeX.Core use GPL-3.0-or-later.
  Consult `desktop/connect/tools/SaveReader/LICENSE`, its sources, rebuilding
  instructions, and `desktop/connect/THIRD-PARTY-NOTICES.md`. Binary distributors
  must meet the corresponding-source and notice requirements; a MIT label on
  PokeStream does not override those obligations.
- Some code, icons, fonts, and dependencies have their own licenses. Preserve
  their attribution and license notices.
- Pokémon names, artwork, badges, sprites and items are not licensed under MIT.
  Their rights remain with Nintendo, Creatures Inc., GAME FREAK and respective
  creators. See PokeAPI attribution and the pinned sprite manifest under
  `desktop/connect/data/sprite-manifest.json`. Verify redistribution permissions
  before making downloadable bundles public.
- PokeStream is a fan project and is not affiliated with Pokémon's rightsholders.

**Before publishing:** check that the author has the rights to publish each source
and bundled resource, remove secrets/private credentials, and review binary
redistribution of GPL and artwork. Publicly releasing source code does not, by
itself, authorize republishing third-party media.

## PokéAPI full sprite library (2.2.4)

PokeStream caches original graphics directly from the user's chosen upstream PokéAPI mirror to the user's own local device. The complete third-party image repository is **not** incorporated into the distributable installer. The published index is from `https://pokeapi.github.io/sprites/manifest.json.gz`. Rights to the individual images are not granted by the MIT license of PokeStream or automatically by the PokéAPI repository license. See `https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt`.

## Language flags

Country flag SVGs: [flag-icons](https://github.com/lipis/flag-icons), version 7.3.2, by Lipis. MIT license; the original license is included in `public/flags/LICENSE` and in the launcher assets.
