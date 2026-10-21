# PokeStream SaveReader

Standalone read-only save-to-JSON converter, GPL-3.0-or-later. Uses unmodified PKHeX.Core 24.11.11 by Kaphotics and contributors.

Usage: PokeStream.SaveReader.exe path/to/save

Opens only that file, read-only; checks save checksums and party fields. JSON on stdout. No network or emulator access.

The distributed executable is built from the complete upstream source at b60c6e5f1427263260061d3f8c5540b924063572. Its corresponding source archive includes this project, PKHeX's source archive and licenses, and REBUILD.ps1. Run REBUILD.ps1 with the .NET 8+ SDK on Windows x64 to rebuild. Runtime 8.0.31 is bundled, with trimming; PKHeX.Core is fully rooted and JSON uses generated serializers.

The app invokes this independently usable converter as a separate process. Unrelated website code has no license change.
