using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
namespace PokeStream.Connect;

public record SavedParty(PartyFrame Frame,string Format,int Generation,string Version,DateTimeOffset SavedAt,string Path);
public sealed class SaveWatcher(string executable) {
    private static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web);
    private string? lastPath,lastHash;private SavedParty? cached;private DateTime nextRead;
    private record Result(string Game,PartyMember[] Team,string Format,int Generation,string Version,int[]? Badges);
    private readonly SemaphoreSlim gate=new(1,1);
    public async Task<SavedParty?> Read(string path,CancellationToken cancellation) {
        await gate.WaitAsync(cancellation);
        try{return await ReadCore(path,cancellation);}finally{gate.Release();}
    }
    private async Task<SavedParty?> ReadCore(string path,CancellationToken cancellation) {
        if(DateTime.UtcNow<nextRead && path==lastPath)return cached;
        nextRead=DateTime.UtcNow.AddSeconds(2);
        if(path!=lastPath){cached=null;lastHash=null;lastPath=path;}
        try {
            var before=new FileInfo(path);
            if(!before.Exists || before.Length is <512 or >8388608 || DateTime.UtcNow-before.LastWriteTimeUtc<TimeSpan.FromMilliseconds(700))return null;
            var stamp=before.LastWriteTimeUtc;var length=before.Length;
            string hash=await Hash(path,cancellation);
            if(hash==lastHash)return cached;
            var start=new ProcessStartInfo(executable){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
            start.ArgumentList.Add(path);
            using var child=Process.Start(start)??throw new IOException("Lecteur de sauvegarde indisponible.");
            using var timeout=CancellationTokenSource.CreateLinkedTokenSource(cancellation);timeout.CancelAfter(TimeSpan.FromSeconds(8));
            string output;
            try {
                var stdout=child.StandardOutput.ReadToEndAsync(timeout.Token);var stderr=child.StandardError.ReadToEndAsync(timeout.Token);
                await child.WaitForExitAsync(timeout.Token);output=await stdout;await stderr;
            } catch(OperationCanceledException){if(!child.HasExited)child.Kill(entireProcessTree:true);if(cancellation.IsCancellationRequested)throw;return null;}
            if(child.ExitCode!=0 || output.Length>16384)return null;
            var result=JsonSerializer.Deserialize<Result>(output,Json);
            if(result==null || result.Team is not {Length:>=1 and <=6} || result.Team.Any(p=>p.Species is <1 or >1025 || p.Level is <1 or >100 || p.Hp<0 || p.MaxHp is <1 or >999 || p.Hp>p.MaxHp || p.Nickname.Length>12))return null;
            var after=new FileInfo(path);
            if(!after.Exists || after.LastWriteTimeUtc!=stamp || after.Length!=length || await Hash(path,cancellation)!=hash)return null;
            cached=new(new(result.Game,result.Team,result.Badges,true),result.Format,result.Generation,result.Version,new DateTimeOffset(stamp),path);lastHash=hash;return cached;
        } catch(Exception e) when(e is IOException or UnauthorizedAccessException or JsonException or System.ComponentModel.Win32Exception) {return null;}
    }
    private static async Task<string> Hash(string path,CancellationToken ct) {
        using var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete,65536,true);
        return Convert.ToHexString(await SHA256.HashDataAsync(stream,ct));
    }
}

public static class SaveDiscovery {
    // Only emulator save roots, bounded and without following links. No system/key directories.
    public static string[] Find(string label,string? emulatorDirectory=null) {
        string roaming=Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var roots=label switch {
            "Citra"=>new[]{Path.Combine(roaming,"Citra","sdmc"),Path.Combine(emulatorDirectory??"","user","sdmc")},
            "Azahar"=>new[]{Path.Combine(roaming,"Azahar","sdmc"),Path.Combine(emulatorDirectory??"","user","sdmc")},
            "Ryujinx"=>new[]{Path.Combine(roaming,"Ryujinx","bis","user","save"),Path.Combine(emulatorDirectory??"","portable","bis","user","save")},
            "Citron"=>new[]{Path.Combine(roaming,"Citron","nand","user","save"),Path.Combine(roaming,"citron-neo","nand","user","save"),Path.Combine(emulatorDirectory??"","user","nand","user","save")},
            _=>Array.Empty<string>()
        };
        var result=new List<string>();int budget=6000;
        foreach(var root in roots.Where(Path.IsPathFullyQualified).Distinct(StringComparer.OrdinalIgnoreCase)){
            var pending=new Stack<(string Path,int Depth)>();pending.Push((root,0));
            while(pending.Count>0 && budget-->0){var (folder,depth)=pending.Pop();try{
                if(!Directory.Exists(folder) || (File.GetAttributes(folder)&FileAttributes.ReparsePoint)!=0)continue;
                foreach(var file in Directory.EnumerateFiles(folder,"main",SearchOption.TopDirectoryOnly))if(new FileInfo(file).Length is >=512 and <=8388608 && (label!="Ryujinx" || Path.GetFileName(folder)=="0"))result.Add(file);
                if(depth<15)foreach(var sub in Directory.EnumerateDirectories(folder))pending.Push((sub,depth+1));
            }catch(Exception e)when(e is IOException or UnauthorizedAccessException){}}
        }
        return result.Distinct(StringComparer.OrdinalIgnoreCase).Order().ToArray();
    }
}
