$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'SDK .NET 8+ required to build Connect.' }
if (-not (Test-Path 'node_modules/.bin/electron-builder.cmd')) { npm ci; if($LASTEXITCODE -ne 0){throw 'npm ci failed.'} }
npm run desktop:pack
if($LASTEXITCODE -ne 0){throw 'Build failed. See output above.'}
Write-Host 'Custom PokeStream launcher created in .artifacts/release/' -ForegroundColor Green
