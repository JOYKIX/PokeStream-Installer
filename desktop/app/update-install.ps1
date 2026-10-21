param(
 [Parameter(Mandatory=$true)][int]$ParentPid,
 [Parameter(Mandatory=$true)][string]$Source,
 [Parameter(Mandatory=$true)][string]$ExpectedHash,
 [Parameter(Mandatory=$true)][string]$ExpectedVersion,
 [Parameter(Mandatory=$true)][string]$ReadyFile
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PokeStream'))
$log=Join-Path $root 'maintenance.log'
$status=Join-Path $root 'maintenance.json'
function Note([string]$text){[IO.File]::AppendAllText($log,([DateTime]::UtcNow.ToString('o')+' '+$text+[Environment]::NewLine))}
try {
 if($ExpectedVersion -notmatch '^\d+\.\d+\.\d+$' -or $ExpectedHash -notmatch '^[a-f0-9]{64}$'){throw 'Invalid update metadata'}
 $expected=[IO.Path]::GetFullPath((Join-Path $root ('Updates\PokeStream-'+$ExpectedVersion+'.exe')))
 if([IO.Path]::GetFullPath($Source) -ne $expected){throw 'Invalid update path'}
 $actual=(Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash.ToLowerInvariant()
 if($actual -ne $ExpectedHash){throw 'Update checksum mismatch'}
 Note ('Update '+$ExpectedVersion+' verified')
 [IO.File]::WriteAllText($ReadyFile,'ready')
 Wait-Process -Id $ParentPid -Timeout 60 -ErrorAction SilentlyContinue
 if(Get-Process -Id $ParentPid -ErrorAction SilentlyContinue){throw 'PokeStream is still running'}
 $env:PORTABLE_EXECUTABLE_FILE=$null;$env:PORTABLE_EXECUTABLE_DIR=$null;$env:PORTABLE_EXECUTABLE_APP_FILENAME=$null
 $child=Start-Process -FilePath $Source -ArgumentList '--apply-update','--open-app' -WindowStyle Hidden -PassThru
 Note ('Setup started: '+$child.Id)
 $deadline=[DateTime]::UtcNow.AddMinutes(5)
 do {
  Start-Sleep -Milliseconds 750
  $record=Join-Path $root 'Application\desktop.json'
  if(Test-Path -LiteralPath $record){
   try{$installed=[IO.File]::ReadAllText($record)|ConvertFrom-Json}catch{$installed=$null}
   if($installed.version -eq $ExpectedVersion){
    [IO.File]::WriteAllText($status,(@{operation='update';success=$true;version=$ExpectedVersion}|ConvertTo-Json -Compress))
    Note ('Update '+$ExpectedVersion+' installed');exit 0
   }
  }
 }while([DateTime]::UtcNow -lt $deadline)
 throw 'Installation did not finish. Open the launcher and retry, or download the latest setup.'
}catch{
 Note ('Update failed: '+$_.Exception.Message)
 [IO.File]::WriteAllText($status,(@{operation='update';success=$false;message=$_.Exception.Message}|ConvertTo-Json -Compress))
 exit 1
}finally{
 Remove-Item -LiteralPath $ReadyFile -Force -ErrorAction SilentlyContinue
 Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
}
