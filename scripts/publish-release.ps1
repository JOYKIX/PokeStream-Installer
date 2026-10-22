param([switch]$KeepOldReleases,[switch]$UpdateOnly,[switch]$Replace)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
$arguments=@('scripts/publish-release.mjs')
if($KeepOldReleases){$arguments+='--keep-old-releases'}
if($UpdateOnly){$arguments+='--update-only'}
if($Replace){$arguments+='--replace'}
& node @arguments
if($LASTEXITCODE -ne 0){throw 'PokeStream publication failed'}
