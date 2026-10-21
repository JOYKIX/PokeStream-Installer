param([string]$Application=(Join-Path $PSScriptRoot '../dist/win-x64/PokeStream Connect.exe'))
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
dotnet build tests/Connect.Probe -c Release
if($LASTEXITCODE -ne 0){throw 'Probe build failed'}
dotnet build tests/Connect.RyujinxFixture -c Release
if($LASTEXITCODE -ne 0){throw 'Ryujinx fixture build failed'}
dotnet build tests/Connect.CitraFixture -c Release
if($LASTEXITCODE -ne 0){throw 'Citra fixture build failed'}
$Application=(Resolve-Path -LiteralPath $Application).Path
$exe=(Resolve-Path -LiteralPath 'tests/Connect.RyujinxFixture/bin/Release/net8.0-windows/Ryujinx.exe').Path
$party=(Resolve-Path -LiteralPath '.artifacts/release-fixtures/party.pk8').Path
$test=Start-Process -FilePath $exe -ArgumentList ('"'+$party+'"') -WindowStyle Hidden -PassThru -RedirectStandardOutput '.artifacts/ryu-fixture.log' -RedirectStandardError '.artifacts/ryu-fixture.err'
try{
    $locate=Start-Process -FilePath $Application -ArgumentList @('--locate-ryujinx',$test.Id,$test.StartTime.ToUniversalTime().Ticks) -WindowStyle Hidden -PassThru -RedirectStandardOutput '.artifacts/ryu-map.json' -RedirectStandardError '.artifacts/ryu-map.err'
    if(-not $locate.WaitForExit(20000)){if($locate.Path -eq $Application){Stop-Process -Id $locate.Id};throw 'Locator timeout'}
    if($locate.ExitCode -ne 0){throw 'Locator failed'}
    $result=dotnet run --project tests/Connect.Probe -c Release --no-build -- $test.Id --mapping .artifacts/ryu-map.json
    if($LASTEXITCODE -ne 0){throw 'Native page read failed'}
    $frame=$result[-1]|ConvertFrom-Json
    if($frame.Game -ne 'galar-sword' -or $frame.Team.Count -ne 1 -or $frame.Team[0].Species -ne 133 -or $frame.Team[0].Hp -ne 1){throw 'Wrong native Switch party'}
    Write-Output 'PASS Ryujinx snapshot, process identity, native page translation, stable team'
}finally{$owned=Get-Process -Id $test.Id -ErrorAction SilentlyContinue;if($owned -and $owned.Path -eq $exe){Stop-Process -Id $owned.Id}}
if(Get-NetUDPEndpoint -LocalPort 45987 -ErrorAction SilentlyContinue){Write-Output 'SKIP Citra loopback fixture: port already in use';return}
$exe=(Resolve-Path -LiteralPath 'tests/Connect.CitraFixture/bin/Release/net8.0-windows/citra-qt.exe').Path
$party=(Resolve-Path -LiteralPath '.artifacts/release-fixtures/party.pk6').Path
$test=Start-Process -FilePath $exe -ArgumentList ('"'+$party+'"') -WindowStyle Hidden -PassThru -RedirectStandardOutput '.artifacts/citra-fixture.log' -RedirectStandardError '.artifacts/citra-fixture.err'
try{
    $result=dotnet run --project tests/Connect.Probe -c Release --no-build -- $test.Id --details
    if($LASTEXITCODE -ne 0){throw 'Citra protocol failed'}
    $frame=$result[-1]|ConvertFrom-Json
    if($frame.Game -ne 'hoenn' -or $frame.Team.Count -ne 1 -or $frame.Team[0].Species -ne 133 -or $frame.Team[0].Nickname -ne 'PIXEL' -or $frame.Team[0].Hp -ne 0){throw 'Wrong Citra party'}
    Write-Output 'PASS Citra loopback protocol, port ownership, stable team'
}finally{$owned=Get-Process -Id $test.Id -ErrorAction SilentlyContinue;if($owned -and $owned.Path -eq $exe){Stop-Process -Id $owned.Id}}
