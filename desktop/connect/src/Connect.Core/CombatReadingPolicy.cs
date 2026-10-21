namespace PokeStream.Connect;

// Some emulators leave freed battle data readable. A change to the field team
// must win over an unchanged combat copy (healing, item management, save states).
public sealed class CombatReadingPolicy {
    private PartyMember[]? lastBattle,lastField;
    private bool suspended;
    // Field PK4-PK7 records do not store types. Compare shared fields only when
    // deciding whether the combat copy is stale; optional metadata is not a state change.
    private static bool SameState(PartyMember[] a,PartyMember[] b)=>a.Length==b.Length &&
        a.Zip(b).All(p=>(p.First with {Types=null})==(p.Second with {Types=null}));
    public void Reset(){lastBattle=null;lastField=null;suspended=false;}
    public PartyFrame Apply(PartyFrame frame) {
        var field=frame.FieldTeam??frame.Team;
        if(!frame.InBattle){Reset();lastField=field;return frame;}
        bool changed=lastBattle!=null && !SameState(lastBattle,frame.Team);
        if(lastBattle==null)suspended=!SameState(field,frame.Team);
        else if(changed)suspended=false;
        else if(lastField!=null && !SameState(lastField,field))suspended=true;
        lastBattle=frame.Team;lastField=field;
        return suspended?frame with {Team=field,InBattle=false,FieldTeam=null}:frame;
    }
}
