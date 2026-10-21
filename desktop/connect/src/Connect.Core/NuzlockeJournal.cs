using System.Text.Json;
namespace PokeStream.Connect;

// Local only: identity history must never be part of the API payload.
public sealed class NuzlockeJournal {
    private sealed record State(int Version,HashSet<uint> DeadPokemonPids,int Adjustment);
    private static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web);
    private readonly string file;
    private State state;
    public int Deaths=>Math.Clamp(state.DeadPokemonPids.Count+state.Adjustment,0,9999);
    public NuzlockeJournal(string folder,Guid adventure) {
        Directory.CreateDirectory(folder);
        file=Path.Combine(folder,adventure.ToString("D")+".json");
        try { state=File.Exists(file)
            ? JsonSerializer.Deserialize<State>(File.ReadAllText(file),Json) ?? throw new InvalidDataException("Historique Nuzlocke illisible.")
            : new(1,[],0); } catch(JsonException e){throw new InvalidDataException("Historique Nuzlocke illisible.",e);}
        if(state.Version!=1 || state.DeadPokemonPids==null || state.Adjustment is <-1000000 or >9999)
            throw new InvalidDataException("Historique Nuzlocke invalide.");
    }
    public bool Observe(IEnumerable<PartyMember> team,bool enabled) {
        if(!enabled)return false;
        var next=new HashSet<uint>(state.DeadPokemonPids);
        foreach(var pokemon in team)
            if(!pokemon.Egg && pokemon.Hp==0 && pokemon.Pid is uint pid)next.Add(pid);
        if(next.SetEquals(state.DeadPokemonPids))return false;
        Commit(state with {DeadPokemonPids=next});return true;
    }
    // A correction changes only the displayed total. Already counted identities stay counted.
    public void CorrectTotal(int total) {
        if(total is <0 or >9999)throw new ArgumentOutOfRangeException(nameof(total));
        if(total==Deaths)return;
        Commit(state with {Adjustment=total-state.DeadPokemonPids.Count});
    }
    public void Reset()=>Commit(new(1,[],0));
    private void Commit(State next) {
        var temp=file+"."+Guid.NewGuid().ToString("N")+".tmp";
        try {
            using(var stream=new FileStream(temp,FileMode.CreateNew,FileAccess.Write,FileShare.None)) {
                JsonSerializer.Serialize(stream,next,Json);stream.Flush(flushToDisk:true);
            }
            File.Move(temp,file,overwrite:true);
            state=next;
        } finally {if(File.Exists(temp))File.Delete(temp);}
    }
}
