namespace PokeStream.Connect;
public enum ReadingSource { Live, Save, Retained, Updating }
public record TeamReading(PartyFrame Frame,ReadingSource Source,DateTimeOffset ObservedAt,string GameName,string GameKey);
public sealed class ReadingPolicy(string? typeMemoryPath=null) {
    private readonly ObservedTypeMemory types=new(typeMemoryPath);
    public void ForgetTypes(string gameKey)=>types.Forget(gameKey);
    private TeamReading? latest;
    public TeamReading? Current=>latest;
    public void Reset()=>latest=null;
    public TeamReading? DuringUpdate(DateTimeOffset now)=>latest?.Source==ReadingSource.Live && now-latest.ObservedAt<TimeSpan.FromSeconds(12)
        ? latest with {Source=ReadingSource.Updating}:null;
    public TeamReading Live(PartyFrame frame,string name,DateTimeOffset now,string? gameKey=null) {
        string key=gameKey??GameIdentity.FromVersion(name)??GameIdentity.FromName(name)??name;
        return latest=new(types.Apply(frame,key,true),ReadingSource.Live,now,name,key);
    }
    public TeamReading? Fallback(PartyFrame? saved,DateTimeOffset savedAt,string name,string? gameKey=null) {
        string key=gameKey??GameIdentity.FromVersion(name)??GameIdentity.FromName(name)??name;
        // A newer disk save may take over only within the same game family and source selection.
        // Hoenn, for example, is shared by GBA and 3DS games and is not an identity.
        if(saved!=null && (latest==null || key==latest.GameKey && saved.Game==latest.Frame.Game && savedAt>latest.ObservedAt))return latest=new(types.Apply(saved,key,false),ReadingSource.Save,savedAt,name,key);
        return latest==null?null:latest with {Source=latest.Source==ReadingSource.Save?ReadingSource.Save:ReadingSource.Retained};
    }
}
