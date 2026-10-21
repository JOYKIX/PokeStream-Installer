param([Parameter(Mandatory=$true)][int]$ParentPid,[Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$ExpectedHash)
$ErrorActionPreference='Stop'
try{Wait-Process -Id $ParentPid -Timeout 45 -ErrorAction SilentlyContinue}catch{}
if(Get-Process -Id $ParentPid -ErrorAction SilentlyContinue){throw 'PokeStream is still running'}
$hash=[System.Security.Cryptography.SHA256]::Create();$stream=[System.IO.File]::OpenRead($Source)
try{$actual=[BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$hash.Dispose()}
if($actual -ne $ExpectedHash){throw 'Update checksum mismatch'}
Start-Process -FilePath $Source -ArgumentList '--apply-update' -WindowStyle Hidden
