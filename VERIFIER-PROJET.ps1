# Verifie le projet sur Windows, sans supprimer de donnees locales.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path 'node_modules/.bin/next.cmd')) {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'Impossible d installer les dependances.' }
}
Write-Host 'Verification des types TypeScript...' -ForegroundColor Cyan
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Erreurs TypeScript detectees.' }
Write-Host 'Verification de la compilation du site Vercel...' -ForegroundColor Cyan
Remove-Item Env:POKESTREAM_LOCAL -ErrorAction SilentlyContinue
npm run build
if ($LASTEXITCODE -ne 0) { throw 'La compilation du site a echoue.' }
Write-Host 'Verification de la compilation locale...' -ForegroundColor Cyan
$env:POKESTREAM_LOCAL = '1'
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'La compilation locale a echoue.' }
} finally {
  Remove-Item Env:POKESTREAM_LOCAL -ErrorAction SilentlyContinue
}
Write-Host 'Verification Next.js et TypeScript reussie (Connect/.NET non teste).' -ForegroundColor Green
