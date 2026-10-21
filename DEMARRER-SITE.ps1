# Site vitrine local (Vercel) : aucun compte et aucun serveur externe.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path 'node_modules/.bin/next.cmd')) { npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci a echoue.' } }
Remove-Item Env:POKESTREAM_LOCAL -ErrorAction SilentlyContinue
Write-Host 'Site vitrine : http://localhost:3000' -ForegroundColor Cyan
npm run dev
