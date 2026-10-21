# Build Windows complet: Next standalone + Connect .NET + installateur NSIS et Electron portable
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'SDK .NET 8 requis : https://dotnet.microsoft.com/download/dotnet/8.0' }
if (-not (Test-Path 'node_modules/.bin/electron-builder.cmd')) { npm ci; if($LASTEXITCODE -ne 0){throw 'npm ci a echoue.'} }
Write-Host 'Premiere compilation : telechargement des sprites et des dependances requis.' -ForegroundColor Yellow
npm run desktop:pack
if($LASTEXITCODE -ne 0){throw 'Compilation interrompue : voir les erreurs ci-dessus.'}
Write-Host 'Installateur et version portable crees dans .artifacts/release/' -ForegroundColor Green
