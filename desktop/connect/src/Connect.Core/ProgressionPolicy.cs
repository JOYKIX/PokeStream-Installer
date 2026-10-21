namespace PokeStream.Connect;
public static class ProgressionPolicy {
    public static PartyFrame WithSavedBadges(PartyFrame live,PartyFrame? saved) {
        if(live.Badges!=null || saved?.Badges==null || saved.Game!=live.Game)return live;
        // A save for another trainer/game must never overwrite this party's progression.
        var livePids=live.Team.Where(p=>p.Pid.HasValue).Select(p=>p.Pid!.Value).ToHashSet();
        if(livePids.Count>0 && !saved.Team.Any(p=>p.Pid is uint pid && livePids.Contains(pid)))return live;
        return live with {Badges=saved.Badges,BadgesFromSave=true};
    }
}
