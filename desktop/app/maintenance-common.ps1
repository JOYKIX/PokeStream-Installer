# Shared maintenance primitives. This file is copied beside the independent worker.
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$script:root=$null
$script:log=$null
$script:status=$null
$script:committed=$false
$script:parent=$null
function Note([string]$text){
 if($script:log){[IO.File]::AppendAllText($script:log,([DateTime]::UtcNow.ToString('o')+' '+$text+[Environment]::NewLine))}
}
function Initialize-Maintenance {
 if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){throw 'LOCALAPPDATA is unavailable'}
 $script:root=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PokeStream')).TrimEnd('\')
 if([IO.Directory]::Exists($script:root) -and (([IO.File]::GetAttributes($script:root) -band [IO.FileAttributes]::ReparsePoint) -ne 0)){throw 'Linked PokeStream root is not supported'}
 [IO.Directory]::CreateDirectory($script:root)|Out-Null
 $script:log=Join-Path $script:root 'maintenance.log'
 $script:status=Join-Path $script:root 'maintenance.json'
 if($ParentPid -lt 1){throw 'Invalid launcher process'}
 $script:parent=[Diagnostics.Process]::GetProcessById($ParentPid)
}
function Write-Result([string]$operation,[bool]$success,[string]$message,[hashtable]$extra=@{}){
 $record=@{operation=$operation;success=$success;message=$message;finishedAt=[DateTime]::UtcNow.ToString('o')}
 foreach($key in $extra.Keys){$record[$key]=$extra[$key]}
 $temp=$ResultFile+'.tmp'
 [IO.File]::WriteAllText($temp,($record|ConvertTo-Json -Compress))
 [IO.File]::Move($temp,$ResultFile)
 [IO.File]::WriteAllText($script:status,($record|ConvertTo-Json -Compress))
}
function Wait-ForCommit {
 # An acknowledgement is not permission to mutate files. An abandoned/timed-out
 # worker must never start later without the launcher's explicit commit.
 [IO.File]::WriteAllText($ReadyFile,'ready')
 Note ('Worker '+$PID+' ready; waiting for launcher commit')
 $deadline=[DateTime]::UtcNow.AddSeconds(90)
 while(![IO.File]::Exists($CommitFile)){
  if([IO.File]::Exists($CancelFile)){throw 'Maintenance cancelled before handoff'}
  if([DateTime]::UtcNow -gt $deadline){throw 'Launcher did not commit maintenance'}
  [Threading.Thread]::Sleep(100)
 }
 if([IO.File]::Exists($CancelFile)){throw 'Maintenance cancelled before handoff'}
 $script:committed=$true
 Note 'Launcher committed; updating application while launcher remains open'
}
function Assert-OwnedFolder([string]$name){
 if($name -notin @('Application','Updates','Studio')){throw 'Unknown product directory'}
 $target=[IO.Path]::GetFullPath((Join-Path $script:root $name))
 if(![string]::Equals([IO.Path]::GetDirectoryName($target),$script:root,[StringComparison]::OrdinalIgnoreCase)){throw 'Refusing access outside PokeStream'}
 if(![IO.Directory]::Exists($target)){return $target}
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
 return $target
}
function Get-FileSha256([string]$file){
 $algorithm=[Security.Cryptography.SHA256]::Create()
 $stream=[IO.File]::OpenRead($file)
 try{return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}
 finally{$stream.Dispose();$algorithm.Dispose()}
}
function Start-NativeProcess([string]$file,[string]$arguments='',[hashtable]$extra=@{}){
 $info=New-Object Diagnostics.ProcessStartInfo
 $info.FileName=$file
 $info.Arguments=$arguments
 $info.WorkingDirectory=[IO.Path]::GetDirectoryName($file)
 $info.UseShellExecute=$false
 $info.CreateNoWindow=$true
 foreach($key in @($info.EnvironmentVariables.Keys)){
  if($key -like 'PORTABLE_*' -or $key -in @('ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH','PSModulePath','POKESTREAM_PARENT_PID','POKESTREAM_INSTANCE','POKESTREAM_ENGINE_TOKEN','POKESTREAM_ENGINE_ID')){$info.EnvironmentVariables.Remove($key)}
 }
 foreach($key in $extra.Keys){$info.EnvironmentVariables[$key]=[string]$extra[$key]}
 return [Diagnostics.Process]::Start($info)
}
function Finish-Maintenance {
 if($script:parent){$script:parent.Dispose()}
 # Keep ready/failure and the operation log for diagnostics, but no runnable helper.
 foreach($file in @('update-install.ps1','uninstall.ps1','maintenance-common.ps1')){
  try{[IO.File]::Delete((Join-Path $PSScriptRoot $file))}catch{}
 }
}
