$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$commit = 'b60c6e5f1427263260061d3f8c5540b924063572'
if ((Get-FileHash -LiteralPath 'pkhex-source.zip' -Algorithm SHA256).Hash -ne 'E469C98A6E50F20E3CA1F3C9875CAEA3EBFFC214B0ECBD9ABF3CB504B1F5086E') { throw 'Source archive checksum mismatch' }
if (-not (Test-Path -LiteralPath "PKHeX-$commit")) { Expand-Archive -LiteralPath 'pkhex-source.zip' -DestinationPath $PSScriptRoot }
$core = Join-Path $PSScriptRoot "PKHeX-$commit/PKHeX.Core/PKHeX.Core.csproj"
dotnet publish SaveReader -c Release -r win-x64 --self-contained true -o publish "-p:PKHeXSource=$core" "-p:SourceRevisionId=$commit"
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
