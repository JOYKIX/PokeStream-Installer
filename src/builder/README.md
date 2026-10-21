# Overlay Builder

The V1 editor composes a 1920 × 1080 OBS scene. Routes: /builder (library), /builder/[id] (editor), /builder/[id]/obs (instructions), /builder/obs/[token] (public display capability).

- schema.ts defines versioned documents and bounded, typed elements; no CSS or HTML input.
- render.tsx is shared by editor, OBS and PNG export. It reuses OverlayRenderer, the theme catalog and custom-theme tokens. A separate untransformed measurement probe prevents zoom and rotation from affecting dynamic component dimensions.
- Transparent game, camera and chat slots mask the complete composition; decorative frames stay outside slot coordinates. OBS uses top-left coordinates for unrotated sources and center coordinates for rotated sources, as marked in the table.
- Each composition references one owned Studio overlay. Its team, badges and Nuzlocke values are merged with the latest Connect snapshot. The selected Studio profile is visible above the canvas. Each dynamic block can follow the main theme, the Studio profile theme, or its own theme. Team illustrations can be overridden independently. The Builder has its own broadcast switch: disabling the older Studio URL does not disable a deliberately linked Builder composition. External capture/video/chat sources are configured in OBS, not captured in the browser.
- Free accounts can create 3 compositions; Pro, VIP and Owner can create 15. Fixed unique database slots prevent concurrent creation bypass. Existing creations are kept after access expires; restricted themes fall back to Carbon at display time. Saving a restricted theme requires current access via canUseTheme.
- Firebase verifies editor identity. Server-only Supabase tables and a private image bucket prevent direct client access. OBS responses exclude account IDs and source tokens; image retrieval validates the composition capability and asset membership. Tokens can be rotated or disabled.
- Imports are re-encoded as PNG in the browser, then checked for PNG signature, dimensions and size on the server. Limits: 80 images/account, 20 MiB/image, 4096 px/side, 60 elements/composition. No arbitrary remote image or chat iframe URLs.
- Drafts are versioned locally; saves use optimistic concurrency. An outdated editor must reload instead of overwriting another edit. PNG is a static snapshot; the browser source polls for saved changes and live data.

Not part of V1: templates, multiselect, custom resolutions, community sharing and dedicated frame controls in Theme Creator. Custom themes already style frames through their existing surface, border, radius, text and accent tokens.

Validation: source review and production compilation only. No automated tests, browser sessions, app launches or emulator tests were run, as requested.

Dynamic blocks use measured painted bounds for selection, resizing, snapping and OBS. Resizing is proportional; a saved scale preserves card/badge size when live content changes. Team and badge layouts can inherit Studio or be overridden independently per Builder element. Badge grids reuse Studio’s generation-aware column options.

Builder appearance: new compositions inherit their main theme for dynamic blocks. Each block can explicitly follow the main theme or Studio, or select its own theme. Main and per-element accent overrides are bounded hex colors, including custom theme tokens. Team sprite/variant overrides are stored only in the Builder document; they never patch the Studio scene. Older documents retain their previous Studio-theme inheritance until changed.

Resize snapping uses the same canvas/element edge and center targets as movement. It respects the active handle, opposite anchor, uniform scale, rotation and zoom; Alt or the snapping toggle disables it.

Image lifecycle: saving removal/replacement of an image, or deleting its composition, releases the last saved reference and queues its Storage object for deletion. Foreign keys protect shared/concurrently saved images. Explicitly discarded draft imports are released on save; undo entries referencing deleted assets are removed. Storage removals happen immediately through the Storage API, with a persistent retry queue drained on authenticated image-library access and daily by /api/builder/cleanup (CRON_SECRET). Images still referenced anywhere are never collected.

Large images use an account-scoped signed upload to private temporary Storage, followed by server validation and immutable final storage. Pending uploads reserve one of the 80 account slots and expire after the upload capability; temporary bytes are queued for removal after that capability expires. Image display uses short-lived signed redirects, avoiding function payload limits in both directions. Final images retain the existing last-reference deletion lifecycle.
