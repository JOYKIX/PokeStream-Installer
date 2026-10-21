param([string]$Website, [switch]$CopyToWebsite, [switch]$SkipTests)
$ErrorActionPreference = 'Stop'
function Get-PokeStreamSha256([string]$FilePath) {
    # System.Management.Automation Get-FileHash is not guaranteed in the runner's nested shell.
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead((Resolve-Path -LiteralPath $FilePath).ProviderPath)
    try { return [System.BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '') }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}
Set-Location -LiteralPath $PSScriptRoot
if ($CopyToWebsite -and [string]::IsNullOrWhiteSpace($Website)) {
    $candidates = @((Join-Path $PSScriptRoot '../..')) + @(Get-ChildItem -LiteralPath (Split-Path $PSScriptRoot) -Directory | Select-Object -ExpandProperty FullName)
    $Website = $candidates | Where-Object {
        $manifest = Join-Path $_ 'package.json'
        (Test-Path -LiteralPath $manifest) -and ((Get-Content -Raw -LiteralPath $manifest | ConvertFrom-Json).name -eq 'pokestream')
    } | Select-Object -First 1
    if (-not $Website) { throw 'Pass -Website with the Studio checkout path.' }
}
$version = '1.0.2'
$upstream = 'b60c6e5f1427263260061d3f8c5540b924063572'
$archiveHash = 'E469C98A6E50F20E3CA1F3C9875CAEA3EBFFC214B0ECBD9ABF3CB504B1F5086E'
$cache = Join-Path $PSScriptRoot '.artifacts/upstream'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$archive = Join-Path $cache 'pkhex-source.zip'
if (-not (Test-Path -LiteralPath $archive)) { Invoke-WebRequest "https://codeload.github.com/kwsch/PKHeX/zip/$upstream" -OutFile $archive }
if ((Get-PokeStreamSha256 $archive) -ne $archiveHash) { throw 'Unexpected upstream source archive' }
$core = Join-Path $cache "PKHeX-$upstream/PKHeX.Core/PKHeX.Core.csproj"
if (-not (Test-Path -LiteralPath $core)) { Expand-Archive -LiteralPath $archive -DestinationPath $cache }

dotnet build tools/SaveReader -c Release
if ($LASTEXITCODE -ne 0) { throw 'Reader build failed' }
if (-not $SkipTests) {
dotnet run --project tests/Connect.Tests -c Release
if ($LASTEXITCODE -ne 0) { throw 'DS tests failed' }
dotnet run --project tests/SaveReader.Tests -c Release -- .artifacts/release-fixtures
if ($LASTEXITCODE -ne 0) { throw 'Multi-generation tests failed' }
}
dotnet publish tools/SaveReader -c Release -r win-x64 --self-contained true -o tools/SaveReader/publish "-p:PKHeXSource=$core" "-p:SourceRevisionId=$upstream"
if ($LASTEXITCODE -ne 0) { throw 'Reader publish failed' }
if (-not $SkipTests) {
foreach ($file in Get-ChildItem -LiteralPath '.artifacts/release-fixtures' -Filter '*.sav') {
    $decoded = & './tools/SaveReader/publish/PokeStream.SaveReader.exe' $file.FullName
    if ($LASTEXITCODE -ne 0 -or ($decoded | ConvertFrom-Json).team[0].species -ne 133) { throw "Published reader fixture failed: $($file.Name)" }
}
}
dotnet publish src/Connect.Desktop -c Release -r win-x64 -o dist/win-x64
if ($LASTEXITCODE -ne 0) { throw 'Desktop publish failed' }
$filename = "PokeStream-Connect-$version-win-x64.exe"
$binary = Join-Path $PSScriptRoot "dist/$filename"
Copy-Item -LiteralPath 'dist/win-x64/PokeStream Connect.exe' -Destination $binary
if ((Get-Item -LiteralPath $binary).Length -ge 100MB) { throw 'Binary exceeds distribution size limit' }
$hash = (Get-PokeStreamSha256 $binary).ToLowerInvariant()
Set-Content -LiteralPath "$binary.sha256" -Value "$hash  $filename"

# Corresponding source for the separate GPL save-to-JSON program, including its exact upstream source.
$stage = Join-Path $PSScriptRoot ".artifacts/source-$version"
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'SaveReader') | Out-Null
foreach ($file in @('Program.cs','BadgeReader.cs','SaveReader.csproj','LICENSE','README.md')) { Copy-Item -LiteralPath "tools/SaveReader/$file" -Destination (Join-Path $stage 'SaveReader') }
Copy-Item -LiteralPath $archive -Destination (Join-Path $stage 'pkhex-source.zip')
Copy-Item -LiteralPath 'tools/SaveReader/REBUILD.ps1' -Destination (Join-Path $stage 'REBUILD.ps1')
$sourceArchive = Join-Path $PSScriptRoot "dist/PokeStream-SaveReader-$version-source.zip"
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $sourceArchive -Force

if ($CopyToWebsite) {
    $downloads = Join-Path $Website 'public/downloads'
    New-Item -ItemType Directory -Force -Path $downloads | Out-Null
    Copy-Item -LiteralPath $binary,"$binary.sha256",$sourceArchive -Destination $downloads
    Copy-Item -LiteralPath 'README.md' -Destination (Join-Path $downloads "PokeStream-Connect-$version-compatibility.txt")
    $notices=Get-Content -Raw -LiteralPath 'THIRD-PARTY-NOTICES.md'
    foreach($file in @('tools/SaveReader/LICENSE','licenses/ClrMD-MIT.txt','licenses/material-symbols-Apache-2.0.txt','licenses/dotnet-LICENSE.txt','licenses/dotnet-THIRD-PARTY-NOTICES.txt')) { $notices+=[Environment]::NewLine+$file+[Environment]::NewLine+(Get-Content -Raw -LiteralPath $file) }
    Set-Content -LiteralPath (Join-Path $downloads "PokeStream-Connect-$version-notices.txt") -Value $notices
    $source = Join-Path $Website 'desktop/connect'
    foreach ($folder in @('src','bridge','data','tests','tools','licenses')) {
        Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot $folder) -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/](bin|obj|publish)[\\/]' } | ForEach-Object {
            $relative = [IO.Path]::GetRelativePath($PSScriptRoot,$_.FullName)
            $target = Join-Path $source $relative
            New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
            Copy-Item -LiteralPath $_.FullName -Destination $target
        }
    }
    foreach ($file in @('README.md','SOURCES.md','THIRD-PARTY-NOTICES.md','publish.ps1','.gitignore')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $source }
}
Write-Output "Built $filename ($hash)"
