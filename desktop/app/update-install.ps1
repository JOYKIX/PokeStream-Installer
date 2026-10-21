param(
 [Parameter(Mandatory=$true)][int]$ParentPid,
 [Parameter(Mandatory=$true)][string]$ReadyFile,
 [Parameter(Mandatory=$true)][string]$ErrorFile,
 [Parameter(Mandatory=$true)][string]$Source,
 [Parameter(Mandatory=$true)][string]$ExpectedHash,
 [Parameter(Mandatory=$true)][string]$ExpectedVersion
)
$ErrorActionPreference='Stop'
$root=$null
$log=$null
$status=$null
function Note([string]$text){
 if($log){[IO.File]::AppendAllText($log,([DateTime]::UtcNow.ToString('o')+' '+$text+[Environment]::NewLine))}
}
function Result([bool]$success,[string]$message){
 if($status){
  [IO.File]::WriteAllText($status,(@{operation='update';success=$success;version=$ExpectedVersion;message=$message}|ConvertTo-Json -Compress))
 }
}
try {
 if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){throw 'LOCALAPPDATA is unavailable'}
 $root=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PokeStream')).TrimEnd('\')
 [IO.Directory]::CreateDirectory($root)|Out-Null
 $log=Join-Path $root 'maintenance.log'
 $status=Join-Path $root 'maintenance.json'
 if($ParentPid -lt 1 -or $ExpectedVersion -notmatch '^\d+\.\d+\.\d+$' -or $ExpectedHash -notmatch '^[a-f0-9]{64}$'){throw 'Invalid update parameters'}
 $expected=[IO.Path]::GetFullPath((Join-Path $root ('Updates\PokeStream-'+$ExpectedVersion+'.exe')))
 if(![string]::Equals([IO.Path]::GetFullPath($Source),$expected,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid update path'}
 if(!(Test-Path -LiteralPath $Source -PathType Leaf)){throw 'Downloaded installer is missing'}
 # Signal successful PowerShell start before hashing a potentially large (~200 MB) EXE.
 # The launcher has already verified the SHA256 before requesting handoff.
 Note ('Update helper launched for '+$ExpectedVersion)
 [IO.File]::WriteAllText($ReadyFile,'ready')
 Wait-Process -Id $ParentPid -Timeout 90 -ErrorAction SilentlyContinue
 if(Get-Process -Id $ParentPid -ErrorAction SilentlyContinue){throw 'PokeStream is still running: cannot safely replace application files'}
 $actual=(Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash.ToLowerInvariant()
 if($actual -ne $ExpectedHash){throw 'Downloaded installer changed after verification (SHA256 mismatch)'}
 Note ('Update '+$ExpectedVersion+' verified; opening installer')
 # Do not hide the installed application window. Windows will manage its normal startup.
 $env:PORTABLE_EXECUTABLE_FILE=$null;$env:PORTABLE_EXECUTABLE_DIR=$null;$env:PORTABLE_EXECUTABLE_APP_FILENAME=$null
 $child=Start-Process -FilePath $Source -ArgumentList @('--apply-update','--open-app') -PassThru
 Note ('Setup started: '+$child.Id)
 $deadline=[DateTime]::UtcNow.AddMinutes(5)
 do {
  Start-Sleep -Milliseconds 750
  $desktop=Join-Path $root 'Application\desktop.json'
  $runtime=Join-Path $root 'Application\runtime.json'
  if((Test-Path -LiteralPath $desktop) -and (Test-Path -LiteralPath $runtime)){
   try{
    $installed=[IO.File]::ReadAllText($desktop)|ConvertFrom-Json
    $runtimeRecord=[IO.File]::ReadAllText($runtime)|ConvertFrom-Json
   }catch{$installed=$null;$runtimeRecord=$null}
   if($installed -and $runtimeRecord -and $installed.version -eq $ExpectedVersion -and $runtimeRecord.version -eq $ExpectedVersion){
    Result $true 'Update installed'
    Note ('Update '+$ExpectedVersion+' installed');exit 0
   }
  }
  $child.Refresh()
  if($child.HasExited -and ([DateTime]::UtcNow -gt $deadline.AddMinutes(-4))){throw 'New PokeStream setup exited before installation completed. Check launcher.log'}
 }while([DateTime]::UtcNow -lt $deadline)
 throw 'The new version did not finish installing. Download its setup directly from GitHub Releases.'
}catch{
 $msg=$_.Exception.Message
 try{Note ('Update failed: '+$msg);Result $false $msg}catch{}
 try{[IO.File]::WriteAllText($ErrorFile,$msg)}catch{}
 exit 1
}finally{
 # Keep the acknowledgement until the old process has exited; cleanup comes later.
 Start-Sleep -Milliseconds 250
 Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
}
