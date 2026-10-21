namespace PokeStream.Connect;

public static class PartyIdentity {
    // Volatile HP, item, level and form may legitimately change between two captures.
    public static bool Same(PartyMember a,PartyMember b)=>a.Pid!=null && a.TrainerId!=null &&
        a.Pid==b.Pid && a.TrainerId==b.TrainerId && a.Species==b.Species && a.Egg==b.Egg;
    public static bool SameOrder(PartyMember[] a,PartyMember[] b)=>a.Length==b.Length && a.Zip(b).All(p=>Same(p.First,p.Second));
    public static PartyMember ConfirmZero(PartyMember first,PartyMember latest)=>
        first.Hp>0 && latest.Hp==0 ? first : latest;
    public static void ConfirmZeros(PartyMember[] first,PartyMember[] latest) {
        for(int i=0;i<latest.Length;i++)latest[i]=ConfirmZero(first[i],latest[i]);
    }
    public static bool Merge(PartyMember[] party,PartyMember[] battle,out PartyMember[] merged) {
        merged=(PartyMember[])party.Clone();
        if(battle.Length!=party.Length)return false;
        var used=new HashSet<int>();
        foreach(var member in battle) {
            var matches=Enumerable.Range(0,party.Length).Where(i=>Same(party[i],member)).ToArray();
            if(matches.Length!=1 || !used.Add(matches[0]))return false;
            merged[matches[0]]=member;
        }
        return true;
    }
}
