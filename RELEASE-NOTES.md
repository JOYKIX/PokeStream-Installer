PokeStream 2.2.3

- Fixed local badge images in Adventure, previews and OBS sources. Badge files are bundled and loaded directly, without the failing image optimizer request.
- Completed missing workspace translations: local profiles, settings, sharing, privacy, navigation and Connect status messages. The workspace and launcher share a persistent language preference (English, French, Japanese, Spanish, German).
- Removed the redundant heading and introductory text above the launcher application card.
- Completed update downloads survive restarts and are checked again before installation. Transient connection failures are retried. A verified external helper takes over before closing the launcher, logs failures and records the installation outcome.
- Failed installations restore the previous runtime and desktop pointers. Update startup flags are preserved when relaunching the installed application.
- Added Uninstall in the custom launcher. Local profiles, creations, images and Nuzlocke journals are kept by default; permanent deletion requires explicitly disabling that option in the confirmation dialog.
- Compiled locally before publication. No test suite or emulator tests were run.

Download **PokeStream-Setup.exe**, close the previous instance, open the setup and select Install. Existing profiles and creations are preserved during installation.

Switch live reading remains experimental.
