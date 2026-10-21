param([Parameter(Mandatory=$true)][string]$ArchivePath,[Parameter(Mandatory=$true)][string]$TargetDirectory)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root=[System.IO.Path]::GetFullPath($TargetDirectory).TrimEnd('\')+'\'
$archive=[System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
try {
 $entries=@($archive.Entries);$count=$entries.Count;$done=0
 foreach($entry in $entries){
  $destination=[System.IO.Path]::GetFullPath((Join-Path $root $entry.FullName))
  if(!$destination.StartsWith($root,[System.StringComparison]::OrdinalIgnoreCase)){throw 'Invalid archive entry'}
  if([string]::IsNullOrEmpty($entry.Name)){[System.IO.Directory]::CreateDirectory($destination)|Out-Null}
  else{[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destination))|Out-Null;[System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$destination,$false)}
  $done++
  if($done%40 -eq 0 -or $done -eq $count){[Console]::WriteLine('{"progress":'+[Math]::Floor(100*$done/[Math]::Max(1,$count))+'}')}
 }
}finally{$archive.Dispose()}
