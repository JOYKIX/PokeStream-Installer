# Modular desktop distribution

## Installed components

Launcher/ contains the independent Electron launcher and its HTML/CSS.
Application/desktop-…/ contains the app shell and Electron runtime.
Application/runtime-…/web/ contains the production Next.js standalone build.
Application/runtime-…/engine/ contains Connect and .NET dependencies.
Studio/ contains profiles, creations, settings and the shared Sprites/ library.

The launcher installer contains no Next.js build, Connect engine, runtime ZIP or sprite library. First installation downloads authenticated components from GitHub. Its own Electron files can be reused for the application. The installed app and installed sprites work offline.

## Incremental builds

- npm run desktop:pack — build changed components, package the bootstrap launcher and prepare signed update assets.
- npm run desktop:update — build changed components and prepare a component update without generating a setup EXE.
- npm run desktop:launcher — package only the launcher, using cached previews.
- npm run desktop:build -- --force — deliberately rebuild components.
- npm run sprites:refresh — explicitly refresh sprite metadata.

Component fingerprints cover source, assets, normalized dependency lock and toolchain. Verified staged output is reused when unchanged; altered or missing cache is rebuilt. Release numbers alone don't invalidate the web cache. Next.js still needs a production build when its source changes.

## Distribution protocol

The Ed25519-signed update.json.gz describes the app shell, web interface and Connect. The launcher embeds the trusted public key. Files use deduplicated, gzip-compressed 1 MiB SHA-256 blocks. The publisher reuses blocks from the previous authenticated manifest and uploads only new blocks.

Immutable content-SHA256.bin assets live in the components-v1 GitHub release. Manifests specify offsets and compressed/raw lengths. The launcher verifies installed blocks, requests missing ranges and verifies every assembled file. If a proxy rejects ranges, it downloads and verifies the required complete content bundles. Unsigned manifests and arbitrary update hosts are rejected.

Publish a component patch with npm run desktop:publish -- -UpdateOnly.
Publish a bootstrap installer with npm run desktop:publish.
Commit and push before publication; artifacts from another commit are rejected.

Component patches retain the latest useful bootstrap download so older launchers can migrate. The new updater reads component releases independently of GitHub's latest bootstrap link. Keep that bootstrap and all content referenced by retained manifests. Shared distribution content is not an obsolete app version.

SOURCE.json links the exact corresponding GPL reader source archive, uploaded once by content hash.

## Installation and cleanup

Assemble and verify files in new version directories while the installed app remains intact. Close the app for pointer replacement; keep the launcher open during app-only updates. An installation journal restores interrupted commits. Retain the previous app until successful workspace startup; restore it if startup fails.

After successful startup, delete obsolete managed directories and update caches. Skip active/prepared updates, validate managed paths and never touch Studio/, including downloaded sprites. Uninstallation retains user data unless removal is explicitly chosen.

The private publishing key is protected with Windows DPAPI outside the repository. The committed public key must match it. Other publishers can supply POKESTREAM_SIGNING_KEY as a protected secret. Never silently regenerate the trusted key or commit a private key.

## Operation coordination (3.0.2)

The updater coordinator publishes ready only after retaining its prepared package, and clears that state after commit. A stale install action rechecks the signed package and prepares missing content again. Preparation, commit, cleanup and uninstall acquire the same PID/token lock; interrupted owners can be recovered, and active owners are never removed. The launcher restarts only when its own component changes.
