param(
 [Parameter(Mandatory=$true)][int]$ParentPid,
 [Parameter(Mandatory=$true)][string]$ReadyFile,
 [switch]$RemoveData
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PokeStream')).TrimEnd('\')
$application=[IO.Path]::GetFullPath((Join-Path $root 'Application'))
$log=Join-Path $root 'maintenance.log'
$status=Join-Path $root 'maintenance.json'
function Note([string]$text){[IO.File]::AppendAllText($log,([DateTime]::UtcNow.ToString('o')+' '+$text+[Environment]::NewLine))}
function RemoveOwnedFolder([string]$name){
 if($name -notin @('Application','Updates','Studio')){throw 'Unknown product directory'}
 $target=[IO.Path]::GetFullPath((Join-Path $root $name))
 if([IO.Path]::GetDirectoryName($target) -ne $root){throw 'Refusing removal outside PokeStream'}
 if(!(Test-Path -LiteralPath $target)){return}
 # Never traverse junctions or symbolic links placed inside a product directory.
 $links=@(Get-ChildItem -LiteralPath $target -Force -Recurse -Attributes ReparsePoint -ErrorAction Stop)
 if((Get-Item -LiteralPath $target -Force).Attributes -band [IO.FileAttributes]::ReparsePoint -or $links.Count -gt 0){throw 'Linked directory detected. Remove the link before uninstalling.'}
 for($attempt=0;$attempt -lt 10;$attempt++){
  try{Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop;return}catch{if($attempt -eq 9){throw};Start-Sleep -Seconds 1}
 }
}
try {
 if([IO.Path]::GetDirectoryName($application) -ne $root){throw 'Invalid installation directory'}
 Note 'Uninstall requested'
 [IO.File]::WriteAllText($ReadyFile,'ready')
 Wait-Process -Id $ParentPid -Timeout 60 -ErrorAction SilentlyContinue
 if(Get-Process -Id $ParentPid -ErrorAction SilentlyContinue){throw 'PokeStream is still running'}
 $shortcutShell=New-Object -ComObject WScript.Shell
 $shortcuts=@((Join-Path ([Environment]::GetFolderPath('Desktop')) 'PokeStream.lnk'),(Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\PokeStream.lnk'))
 foreach($link in $shortcuts){
  if(Test-Path -LiteralPath $link){
   $target=$shortcutShell.CreateShortcut($link).TargetPath
   if($target -and [IO.Path]::GetFullPath($target).StartsWith($application+'\',[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $link -Force}
  }
 }
 RemoveOwnedFolder 'Application'
 RemoveOwnedFolder 'Updates'
 if($RemoveData){RemoveOwnedFolder 'Studio'}
 [IO.File]::WriteAllText($status,(@{operation='uninstall';success=$true;dataRemoved=[bool]$RemoveData}|ConvertTo-Json -Compress))
 Note ('Uninstall completed; data removed: '+[bool]$RemoveData)
}catch{
 Note ('Uninstall failed: '+$_.Exception.Message)
 [IO.File]::WriteAllText($status,(@{operation='uninstall';success=$false;message=$_.Exception.Message}|ConvertTo-Json -Compress))
 exit 1
}finally{
 Remove-Item -LiteralPath $ReadyFile -Force -ErrorAction SilentlyContinue
 Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
}
