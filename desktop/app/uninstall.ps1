param(
 [Parameter(Mandatory=$true)][int]$ParentPid,
 [Parameter(Mandatory=$true)][string]$ReadyFile,
 [Parameter(Mandatory=$true)][string]$ErrorFile,
 [switch]$RemoveData
)
$ErrorActionPreference='Stop'
$root=$null
$application=$null
$log=$null
$status=$null
function Note([string]$text){
 if($log){[IO.File]::AppendAllText($log,([DateTime]::UtcNow.ToString('o')+' '+$text+[Environment]::NewLine))}
}
function Result([bool]$success,[string]$message){
 if($status){
  [IO.File]::WriteAllText($status,(@{operation='uninstall';success=$success;dataRemoved=[bool]$RemoveData;message=$message}|ConvertTo-Json -Compress))
 }
}
function RemoveOwnedFolder([string]$name){
 if($name -notin @('Application','Updates','Studio')){throw 'Unknown product directory'}
 $target=[IO.Path]::GetFullPath((Join-Path $root $name))
 if(![string]::Equals([IO.Path]::GetDirectoryName($target),$root,[StringComparison]::OrdinalIgnoreCase)){throw 'Refusing removal outside PokeStream'}
 if(!(Test-Path -LiteralPath $target)){return}
 # Explicitly walk directory entries without following reparse points. A junction
 # must never redirect an uninstaller into arbitrary user or system files.
 $stack=New-Object 'System.Collections.Generic.Stack[string]'
 $stack.Push($target)
 while($stack.Count -gt 0){
  $current=$stack.Pop()
  if(([IO.File]::GetAttributes($current) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Linked directory detected: '+$current}
  foreach($entry in [IO.Directory]::EnumerateFileSystemEntries($current)){
   $attributes=[IO.File]::GetAttributes($entry)
   if(($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Linked file detected: '+$entry}
   if(($attributes -band [IO.FileAttributes]::Directory) -ne 0){$stack.Push($entry)}
  }
 }
 for($attempt=0;$attempt -lt 20;$attempt++){
  try{Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop;return}
  catch{if($attempt -eq 19){throw};Start-Sleep -Milliseconds 750}
 }
}
try {
 if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){throw 'LOCALAPPDATA is unavailable'}
 $root=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PokeStream')).TrimEnd('\')
 [IO.Directory]::CreateDirectory($root)|Out-Null
 $application=[IO.Path]::GetFullPath((Join-Path $root 'Application'))
 $log=Join-Path $root 'maintenance.log'
 $status=Join-Path $root 'maintenance.json'
 if($ParentPid -lt 1 -or ![string]::Equals([IO.Path]::GetDirectoryName($application),$root,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid uninstallation location'}
 Note ('Uninstall helper launched; preserveData='+(!$RemoveData))
 [IO.File]::WriteAllText($ReadyFile,'ready')
 Wait-Process -Id $ParentPid -Timeout 90 -ErrorAction SilentlyContinue
 if(Get-Process -Id $ParentPid -ErrorAction SilentlyContinue){throw 'PokeStream is still running: cannot safely uninstall'}
 $shortcutShell=New-Object -ComObject WScript.Shell
 $shortcuts=@((Join-Path ([Environment]::GetFolderPath('Desktop')) 'PokeStream.lnk'),(Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\PokeStream.lnk'))
 foreach($link in $shortcuts){
  if(Test-Path -LiteralPath $link){
   $shortcutTarget=$shortcutShell.CreateShortcut($link).TargetPath
   if($shortcutTarget -and [IO.Path]::GetFullPath($shortcutTarget).StartsWith($application+'\',[StringComparison]::OrdinalIgnoreCase)){
    Remove-Item -LiteralPath $link -Force -ErrorAction Stop
   }
  }
 }
 RemoveOwnedFolder 'Application'
 RemoveOwnedFolder 'Updates'
 if($RemoveData){RemoveOwnedFolder 'Studio'}
 Result $true 'PokeStream uninstalled'
 Note ('Uninstall completed; data removed: '+[bool]$RemoveData)
}catch{
 $msg=$_.Exception.Message
 try{Note ('Uninstall failed: '+$msg);Result $false $msg}catch{}
 try{[IO.File]::WriteAllText($ErrorFile,$msg)}catch{}
 exit 1
}finally{
 Start-Sleep -Milliseconds 250
 Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
}
