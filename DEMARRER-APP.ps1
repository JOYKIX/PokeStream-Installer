# Developpement du logiciel PokeStream (Windows + Electron + Next local)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path 'node_modules/.bin/electron.cmd')) { npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci a echoue.' } }
Write-Host 'Demarrage de PokeStream Desktop local...' -ForegroundColor Cyan
Write-Host 'Si Connect.exe n est pas encore compile, les outils fonctionnent mais la synchronisation emulation reste indisponible.' -ForegroundColor Yellow
npm run dev:desktop
