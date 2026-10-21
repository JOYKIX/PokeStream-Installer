# Theme Creator

Account-owned themes live here, separately from built-in game themes.

- schema.ts: versioned Zod contract, hex colours, bounded sizes, enumerated fonts and sprite sources.
- appearance.ts: safe CSS variables generated from this contract. No arbitrary CSS, HTML, uploaded assets or external URLs.
- custom.css: appearance only, shared renderer geometry, responsive preview and shared recessed badge treatment.
- theme-studio.tsx / studio.css: three-panel workspace, independent scrolling, clickable preview, grouped undo/redo, explicit saves and conflict protection.
- editor-settings.tsx / controls.tsx: element-specific controls, precise numeric input, color picker, per-setting and per-section resets.
- editor-options.ts: navigation, coordinated palettes, section defaults and validated portable theme files.
- preview.ts: sample team or an account profile snapshot, layout choices and optional HP/KO/shiny/egg simulations. Preview controls never update the profile.
- server.ts: service-role reads scoped to the verified Firebase subject.
- resolve.ts: resolves scene references to the account's current definitions.
- use-custom-themes.ts: refreshes the Studio library on focus and periodically while visible.

## Persistence and access

custom_themes stores five numbered slots per owner. A unique owner/slot constraint and a 1–5 check enforce the limit under concurrent writes. Browser roles have no direct table privileges; APIs require verified Firebase identity, same-origin writes, structured validation, and current Pro/VIP/Owner entitlement. Updates and deletes include a version to reject stale writes.

Scenes store style.theme = custom and style.customThemeId. A database trigger validates ownership and strips all submitted style.customTheme snapshots. Deleting a theme atomically switches referencing scenes to Carbon and removes its favorites. Saved themes remain available to their owner for deletion if premium access expires.

## Rendering

The Studio resolves definitions from its account library. OBS receives only a theme reference from read_overlay. Its existing access endpoint revalidates the owner's entitlement and returns the validated display definition, without owner information. Short-lived permits refresh every 10 seconds and expire after at most 15 seconds. Config edits reach existing OBS sources without changing their links.

Default sprite and variant are copied when a theme is selected. Subsequent illustration changes remain per overlay. Accent follows the saved theme unless an overlay uses customAccent; the Studio includes a button to restore the theme colour. Theme sizes multiply the existing overlay size controls. Name, level, type, gender, HP, item, badge and counter layouts still use the same renderer, including egg redaction, KO appearance and measured OBS dimensions.

All interface strings belong to the five shared i18n catalogs. User-entered theme names are never translated.


## Editor configuration

Schema version 1 remains compatible with existing saved themes: new fields have explicit defaults. Surfaces support linear/radial gradients, directional borders and bounded procedural textures. Text has tracking, uppercase and shadow options; sprites have a rotation and optional shadow or accent glow. The 18 type colors resolve on each pill, with editable palettes and tonal/filled/outline variants. Badge and counter settings keep the shared geometry and badge imprint.

Account profile reads are scoped to the authenticated owner. Only validated scene data and display names reach the preview, without share tokens. The imported JSON format is pokestream-theme, version 1; files are size limited and parsed through the same strict schema as API writes. Imports remain drafts until saved, and consume one of the existing five slots. They contain no HTML, CSS, uploaded assets or remote URLs. Surface copy/paste is local to the editor and does not access the operating-system clipboard.
