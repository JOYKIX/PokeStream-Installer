param([switch]$KeepOldReleases)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
$repo='JOYKIX/PokeStream-Installer'
$remote=git remote get-url origin
if($remote.TrimEnd('/') -ne 'https://github.com/JOYKIX/PokeStream-Installer.git'){throw 'Unexpected Git remote'}
$manifest=Get-Content -Raw package.json | ConvertFrom-Json
$version=$manifest.version
if($version -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid version'}
$tag="v$version";$commit=(git rev-parse HEAD).Trim()
if(git status --porcelain){throw 'Commit all source changes before publishing'}
$remoteHead=(git ls-remote origin refs/heads/main) -split '\s+'
if($remoteHead[0] -ne $commit){throw 'Push the compiled source commit to origin/main first'}
$dir=Join-Path (Get-Location) '.artifacts/release'
$binary=Join-Path $dir "PokeStream-$version-win-x64.exe"
$infoFile=Join-Path $dir 'build-info.json'
if(!(Test-Path -LiteralPath $binary) -or !(Test-Path -LiteralPath $infoFile)){throw 'Compile locally with npm run desktop:pack first'}
$info=Get-Content -Raw -LiteralPath $infoFile | ConvertFrom-Json
if($info.version -ne $version -or $info.commit -ne $commit){throw 'The local binary does not match this source commit. Rebuild first.'}
$alias=Join-Path $dir 'PokeStream-Setup.exe';Copy-Item -LiteralPath $binary -Destination $alias -Force
$sources=@(Get-ChildItem 'desktop/connect/dist' -Filter '*-source.zip' | Sort-Object LastWriteTime -Descending)
if($sources.Count -eq 0){throw 'Corresponding SaveReader source archive missing'}
$sourceFile=Join-Path $dir $sources[0].Name;Copy-Item -LiteralPath $sources[0].FullName -Destination $sourceFile -Force
$files=@($binary,$alias,$sourceFile,$infoFile)
function FileHash([string]$file){
 $algorithm=[Security.Cryptography.SHA256]::Create();$stream=[IO.File]::OpenRead($file)
 try{return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$algorithm.Dispose()}
}
$sumFile=Join-Path $dir 'SHA256SUMS.txt'
$lines=foreach($file in $files){(FileHash $file)+'  '+[IO.Path]::GetFileName($file)}
$lines | Set-Content -LiteralPath $sumFile -Encoding ascii
$files+=@($sumFile)
# Use the same credential helper as git push. Credentials are held only in memory,
# sent only to GitHub, never written into artifacts, arguments or logs.
$credentialInput="protocol=https"+[char]10+"host=github.com"+[char]10+[char]10
$credentialLines=$credentialInput | git credential fill
if($LASTEXITCODE -ne 0){throw 'GitHub authentication unavailable'}
$credential=@{};foreach($line in $credentialLines){$pair=$line -split '=',2;if($pair.Count -eq 2){$credential[$pair[0]]=$pair[1]}}
if(!$credential.password){throw 'Sign in to GitHub through Git Credential Manager first'}
$headers=@{Authorization='Bearer '+$credential.password;Accept='application/vnd.github+json';'X-GitHub-Api-Version'='2026-03-10';'User-Agent'='PokeStream-Local-Release'}
$api='https://api.github.com/repos/'+$repo
function JsonBody($value){return [Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 8 -Compress))}
$release=$null;$published=$false;$client=$null
try{
 try{$existing=Invoke-RestMethod "$api/releases/tags/$tag" -Headers $headers;if($existing){throw "Release $tag already exists. Increment version."}}
 catch{if(!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404){throw}}
 $notes=Get-Content -Raw -LiteralPath 'RELEASE-NOTES.md'
 $release=Invoke-RestMethod "$api/releases" -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body (JsonBody @{tag_name=$tag;target_commitish=$commit;name="PokeStream $version";body=$notes;draft=$true;prerelease=$false})
 $uploadBase=($release.upload_url -split '\{')[0]
 if(([Uri]$uploadBase).Scheme -ne 'https' -or ([Uri]$uploadBase).Host -ne 'uploads.github.com'){throw 'Unexpected upload destination'}
 Add-Type -AssemblyName System.Net.Http
 $client=[Net.Http.HttpClient]::new();$client.Timeout=[TimeSpan]::FromMinutes(15)
 foreach($entry in $headers.GetEnumerator()){$client.DefaultRequestHeaders.TryAddWithoutValidation($entry.Key,[string]$entry.Value)|Out-Null}
 foreach($file in $files){
  $name=[IO.Path]::GetFileName($file);Write-Host "Uploading $name"
  $stream=[IO.File]::OpenRead($file);$content=[Net.Http.StreamContent]::new($stream)
  $content.Headers.ContentType=[Net.Http.Headers.MediaTypeHeaderValue]::new('application/octet-stream')
  try{
   $response=$client.PostAsync($uploadBase+'?name='+[Uri]::EscapeDataString($name),$content).GetAwaiter().GetResult()
   try{if(!$response.IsSuccessStatusCode){throw "Upload failed for $name (HTTP $([int]$response.StatusCode))"}}finally{$response.Dispose()}
  }finally{$content.Dispose();$stream.Dispose()}
 }
 $assets=Invoke-RestMethod "$api/releases/$($release.id)/assets" -Headers $headers
 foreach($file in $files){$found=@($assets | Where-Object name -eq ([IO.Path]::GetFileName($file)));if($found.Count -ne 1 -or $found[0].size -ne (Get-Item -LiteralPath $file).Length){throw 'Uploaded asset size mismatch'}}
 $release=Invoke-RestMethod "$api/releases/$($release.id)" -Method Patch -Headers $headers -ContentType 'application/json; charset=utf-8' -Body (JsonBody @{draft=$false;make_latest='true'})
 $published=$true;Write-Host "Published $($release.html_url)"
 if(!$KeepOldReleases){
  $old=Invoke-RestMethod "$api/releases?per_page=100" -Headers $headers
  foreach($item in $old){
   if(!$item.draft -and $item.tag_name -match '^v(\d+\.\d+\.\d+)$' -and [version]$Matches[1] -lt [version]$version){
    Invoke-RestMethod "$api/releases/$($item.id)" -Method Delete -Headers $headers | Out-Null
    # Remove only the version tag belonging to the deleted release; retain commit history.
    try{Invoke-RestMethod "$api/git/refs/tags/$([Uri]::EscapeDataString($item.tag_name))" -Method Delete -Headers $headers | Out-Null}catch{if(!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404){throw}}
    Write-Host "Removed old release $($item.tag_name)"
   }
  }
 }
} catch {
 if($release -and !$published){try{Invoke-RestMethod "$api/releases/$($release.id)" -Method Delete -Headers $headers | Out-Null}catch{}}
 throw
} finally {
 if($client){$client.Dispose()};$headers.Clear();$credential.Clear();$credentialLines=$null
}
