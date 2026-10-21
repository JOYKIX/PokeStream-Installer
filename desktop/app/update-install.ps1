param(
 [Parameter(Mandatory=$true)][int]$ParentPid,
 [Parameter(Mandatory=$true)][string]$ReadyFile,
 [Parameter(Mandatory=$true)][string]$ErrorFile,
 [Parameter(Mandatory=$true)][string]$CommitFile,
 [Parameter(Mandatory=$true)][string]$CancelFile,
 [Parameter(Mandatory=$true)][string]$ResultFile,
 [Parameter(Mandatory=$true)][string]$Source,
 [Parameter(Mandatory=$true)][string]$ExpectedHash,
 [Parameter(Mandatory=$true)][string]$ExpectedVersion,
 [switch]$UpdateLauncher,
 [switch]$Repair
)
. (Join-Path $PSScriptRoot 'maintenance-common.ps1')
try {
 Initialize-Maintenance
 if($ExpectedVersion -notmatch '^\d+\.\d+\.\d+$' -or $ExpectedHash -notmatch '^[a-f0-9]{64}$'){throw 'Invalid update parameters'}
 if($Repair){
  $application=Assert-OwnedFolder 'Application'
  $record=[IO.File]::ReadAllText((Join-Path $application 'desktop.json'))|ConvertFrom-Json
  if($record.version -ne $ExpectedVersion -or $record.directory -notmatch '^desktop-[a-zA-Z0-9.-]+$'){throw 'Invalid application to repair'}
  $expected=Join-Path (Join-Path $application $record.directory) 'PokeStream.exe'
 }else{
  $updates=Assert-OwnedFolder 'Updates'
  $expected=Join-Path $updates ('PokeStream-'+$ExpectedVersion+'.exe')
 }
 if(![string]::Equals([IO.Path]::GetFullPath($Source),[IO.Path]::GetFullPath($expected),[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid update path'}
 if(![IO.File]::Exists($Source)){throw 'Downloaded installer is missing'}
 if((Get-FileSha256 $Source) -ne $ExpectedHash){throw 'Downloaded installer failed verification (SHA256 mismatch)'}
 Note ('Application '+$ExpectedVersion+' verified before handoff; repair='+[bool]$Repair+'; updateLauncher='+[bool]$UpdateLauncher)
 Wait-ForCommit
 if((Get-FileSha256 $Source) -ne $ExpectedHash){throw 'Downloaded installer changed after verification (SHA256 mismatch)'}
 $installedFile=Join-Path $PSScriptRoot 'installed.json'
 $arguments='--install-only'
 if($Repair){$arguments+=' --repair'}
 if($UpdateLauncher){$arguments+=' --include-launcher'}
 $child=Start-NativeProcess $Source $arguments @{POKESTREAM_INSTALL_RESULT=$installedFile}
 Note ('Installer started: '+$child.Id+'; launcher '+$ParentPid+' remains open')
 $deadline=[DateTime]::UtcNow.AddMinutes(5)
 do {
  [Threading.Thread]::Sleep(250)
  if([IO.File]::Exists($installedFile)){
   $result=[IO.File]::ReadAllText($installedFile)|ConvertFrom-Json
   if(!$result.success){throw $result.message}
   $desktop=[IO.File]::ReadAllText((Join-Path $root 'Application\desktop.json'))|ConvertFrom-Json
   $runtime=[IO.File]::ReadAllText((Join-Path $root 'Application\runtime.json'))|ConvertFrom-Json
   if($result.version -ne $ExpectedVersion -or $desktop.version -ne $ExpectedVersion -or $runtime.version -ne $ExpectedVersion){throw 'Installed application version does not match the requested update'}
   Write-Result 'update' $true 'Application installed; launcher remained open' @{version=$ExpectedVersion;launcherVersion=$result.launcherVersion}
   Note ('Application '+$ExpectedVersion+' installed successfully')
   exit 0
  }
  # A portable bootstrap can exit while its extracted installer is running.
  # The new installer itself writes the completion record after both manifests.
 }while([DateTime]::UtcNow -lt $deadline)
 throw 'Application installation did not finish. Open the logs and retry.'
}catch{
 $msg=$_.Exception.Message
 try{Note ('Update failed: '+$msg);Write-Result 'update' $false $msg @{version=$ExpectedVersion}}catch{}
 try{[IO.File]::WriteAllText($ErrorFile,$msg)}catch{}
 exit 1
}finally{Finish-Maintenance}
