param([Parameter(Mandatory=$true)][int]$ParentPid,[Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Destination,[Parameter(Mandatory=$true)][string]$ExpectedHash)
$ErrorActionPreference='Stop'
try{Wait-Process -Id $ParentPid -Timeout 45 -ErrorAction SilentlyContinue}catch{}
$hash=[System.Security.Cryptography.SHA256]::Create();$stream=[System.IO.File]::OpenRead($Source)
try{$actual=[BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$hash.Dispose()}
if($actual -ne $ExpectedHash){throw 'Update checksum mismatch'}
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($Destination))|Out-Null
$copied=$false
for($i=0;$i -lt 30;$i++){
 try{[System.IO.File]::Copy($Source,$Destination,$true);$copied=$true;break}catch{Start-Sleep -Milliseconds 1000}
}
if(!$copied){throw 'Cannot replace PokeStream launcher'}
Start-Process -FilePath $Destination -WindowStyle Hidden
