param(
 [Parameter(Mandatory=$true)][int]$ParentPid,
 [Parameter(Mandatory=$true)][string]$ReadyFile,
 [Parameter(Mandatory=$true)][string]$ErrorFile,
 [Parameter(Mandatory=$true)][string]$CommitFile,
 [Parameter(Mandatory=$true)][string]$CancelFile,
 [Parameter(Mandatory=$true)][string]$ResultFile,
 [switch]$RemoveData
)
. (Join-Path $PSScriptRoot 'maintenance-common.ps1')
function Remove-OwnedFolder([string]$name){
 $target=Assert-OwnedFolder $name
 if(![IO.Directory]::Exists($target)){return}
 for($attempt=0;$attempt -lt 30;$attempt++){
  try{
   # Remove read-only flags on product files; reject links again before each retry.
   $target=Assert-OwnedFolder $name
   foreach($file in [IO.Directory]::EnumerateFiles($target,'*',[IO.SearchOption]::AllDirectories)){
    $attrs=[IO.File]::GetAttributes($file)
    if(($attrs -band [IO.FileAttributes]::ReadOnly) -ne 0){[IO.File]::SetAttributes($file,($attrs -band (-bnot [IO.FileAttributes]::ReadOnly)))}
   }
   [IO.Directory]::Delete($target,$true)
   return
  }catch{if($attempt -eq 29){throw};[Threading.Thread]::Sleep(500)}
 }
}
try {
 Initialize-Maintenance
 $names=@('Application','Updates')
 if($RemoveData){$names+=@('Studio')}
 # Preflight EVERY target before acknowledging or removing anything.
 foreach($name in $names){[void](Assert-OwnedFolder $name)}
 $application=Join-Path $root 'Application'
 Note ('Uninstall validated; preserveData='+(!$RemoveData))
 Wait-ForCommit
 foreach($name in $names){Remove-OwnedFolder $name;Note ('Removed '+$name)}
 # Keep working shortcuts until the actual application removal has succeeded.
 $shortcutShell=New-Object -ComObject WScript.Shell
 $shortcuts=@((Join-Path ([Environment]::GetFolderPath('Desktop')) 'PokeStream.lnk'),(Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\PokeStream.lnk'))
 foreach($link in $shortcuts){
  if([IO.File]::Exists($link)){
   $target=$shortcutShell.CreateShortcut($link).TargetPath
   if($target -and [IO.Path]::GetFullPath($target).StartsWith($application+'\',[StringComparison]::OrdinalIgnoreCase)){
    try{[IO.File]::Delete($link)}catch{Note ('Shortcut cleanup: '+$_.Exception.Message)}
   }
  }
 }
 Write-Result 'uninstall' $true 'PokeStream uninstalled' @{dataRemoved=[bool]$RemoveData}
 Note ('Uninstall completed; data removed: '+[bool]$RemoveData)
}catch{
 $msg=$_.Exception.Message
 try{Note ('Uninstall failed: '+$msg);Write-Result 'uninstall' $false $msg @{dataRemoved=$false}}catch{}
 try{[IO.File]::WriteAllText($ErrorFile,$msg)}catch{}

 exit 1
}finally{Finish-Maintenance}
