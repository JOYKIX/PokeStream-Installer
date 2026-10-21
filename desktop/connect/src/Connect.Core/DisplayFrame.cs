using System.Text.Json.Serialization;
namespace PokeStream.Connect;

// Deliberately independent from PartyMember: Pid and raw game data cannot cross this boundary.
public sealed record DisplayMember(int Species,string Nickname,int Level,bool Shiny,bool Egg,int Hp,int MaxHp,
    [property:JsonIgnore(Condition=JsonIgnoreCondition.WhenWritingNull)] int? HeldItem = null,
    [property:JsonIgnore(Condition=JsonIgnoreCondition.WhenWritingNull)] int? Gender = null,
    [property:JsonIgnore(Condition=JsonIgnoreCondition.WhenWritingNull)] int? Form = null,
    [property:JsonIgnore(Condition=JsonIgnoreCondition.WhenWritingNull)] int? Generation = null,
    [property:JsonIgnore(Condition=JsonIgnoreCondition.WhenWritingNull)] string[]? Types = null);
public sealed record DisplayFrame(
    string SceneId,string Game,DisplayMember[] Team,
    [property:JsonIgnore(Condition=JsonIgnoreCondition.WhenWritingNull)] int? Deaths,
    [property:JsonIgnore(Condition=JsonIgnoreCondition.WhenWritingNull)] int[]? Badges) {
    public static DisplayFrame From(string sceneId,PartyFrame frame,int? deaths)=>new(
        sceneId,frame.Game,frame.Team.Select(p=>p.Egg ? new DisplayMember(1,"",1,false,true,1,1)
            : new DisplayMember(p.Species,p.Nickname,p.Level,p.Shiny,false,p.Hp,p.MaxHp,p.HeldItem,p.Gender,p.Form,p.Generation,p.Types?.ToArray())).ToArray(),
        deaths,frame.Badges?.Distinct().Order().ToArray());
}
