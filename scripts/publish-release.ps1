param([switch]$KeepOldReleases,[switch]$UpdateOnly)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
$arguments=@('scripts/publish-release.mjs')
if($KeepOldReleases){$arguments+='--keep-old-releases'}
if($UpdateOnly){$arguments+='--update-only'}
& node @arguments
if($LASTEXITCODE -ne 0){throw 'PokeStream publication failed'}
