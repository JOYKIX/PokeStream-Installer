using System.Text.Json;
namespace PokeStream.Connect;

// PK4-PK7 have no type fields outside battle. Keep the first confirmed game
// observation per individual, species and form; never learn from save/catalog data.
public sealed class ObservedTypeMemory(string? path=null) {
    private const int Limit=4096;
    private Dictionary<string,string[]>? entries;
    private static string? Key(string game,PartyMember p)=>!p.Egg && p.Pid!=null && p.TrainerId!=null && p.Generation is >=4 and <=7
        ? $"{game}:{p.Generation}:{p.TrainerId:X8}:{p.Pid:X8}:{p.Species}:{p.Form??0}:{(p.Species is 493 or 773?p.HeldItem??0:0)}":null;
    private void Load() {
        if(entries!=null)return;
        entries=new(StringComparer.Ordinal);
        try {
            if(path==null || !File.Exists(path) || new FileInfo(path).Length>1_048_576)return;
            var saved=JsonSerializer.Deserialize<Dictionary<string,string[]>>(File.ReadAllText(path));
            if(saved==null)return;
            foreach(var (key,value) in saved.TakeLast(Limit))
                if(key.Length<=160 && GameTypes.FromNames(value)!=null)entries[key]=value;
        }catch(Exception e)when(e is IOException or UnauthorizedAccessException or JsonException){}
    }
    private void Save() {
        if(path==null)return;
        try {
            string? folder=Path.GetDirectoryName(path);if(folder!=null)Directory.CreateDirectory(folder);
            File.WriteAllText(path+".tmp",JsonSerializer.Serialize(entries));File.Move(path+".tmp",path,true);
        }catch(Exception e)when(e is IOException or UnauthorizedAccessException){}
    }
    public PartyFrame Apply(PartyFrame frame,string game,bool learn) {
        Load();bool dirty=false;
        var team=frame.Team.Select(p=>{
            string? key=Key(game,p);if(key==null)return p;
            // Once learned, mid-battle effects (Soak, etc.) do not overwrite the
            // out-of-battle type. Live types still take priority while available.
            if(learn && p.Types is {} observed && !entries!.ContainsKey(key)) {
                if(entries.Count>=Limit)entries.Remove(entries.Keys.First());
                entries[key]=observed.ToArray();dirty=true;
            }
            return p.Types==null && entries!.TryGetValue(key,out var types)
                ? p with {Types=GameTypes.FromNames(types)}:p;
        }).ToArray();
        if(dirty)Save();
        return frame with {Team=team};
    }
    public void Forget(string game) {
        Load();
        foreach(string key in entries!.Keys.Where(k=>k.StartsWith(game+":",StringComparison.Ordinal)).ToArray())entries.Remove(key);
        Save();
    }
}
