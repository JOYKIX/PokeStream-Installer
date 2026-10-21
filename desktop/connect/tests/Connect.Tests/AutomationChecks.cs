using System.Text.Json;
using PokeStream.Connect;
static class AutomationChecks {
    public static void Run(Action<bool,string> check) {
        var folder=Path.Combine(Path.GetTempPath(),"pokestream-tests-"+Guid.NewGuid().ToString("N"));
        var adventure=Guid.NewGuid();
        var ko=new PartyMember(133,"Pixel",25,false,false,0,65,0);
        var second=ko with {Pid=42};
        try {
            var journal=new NuzlockeJournal(folder,adventure);
            check(!journal.Observe([ko],false)&&journal.Deaths==0,"disabled Nuzlocke");
            check(journal.Observe([ko],true)&&journal.Deaths==1,"KO at startup with PID zero");
            var file=Path.Combine(folder,adventure+".json");var stamp=File.GetLastWriteTimeUtc(file);
            check(!journal.Observe([ko],true)&&File.GetLastWriteTimeUtc(file)==stamp,"unchanged team causes no write");
            journal.Observe([ko with {Hp=65}],true);
            journal.Observe([ko with {Species=134,Nickname="Changed",Level=50}],true);
            check(journal.Deaths==1,"revival, evolution and renaming preserve identity");
            journal.Observe([second,ko],true);
            check(journal.Deaths==2,"same species with different PID counted separately");
            journal.Observe([],true);journal.Observe([ko,second],true);
            check(journal.Deaths==2,"slot swaps and team removal do not recount");
            journal=new NuzlockeJournal(folder,adventure);
            journal.Observe([second,ko],true);check(journal.Deaths==2,"restart preserves history");
            journal.Observe([ko with {Pid=70,Egg=true},ko with {Pid=null}],true);
            check(journal.Deaths==2,"eggs and absent identities ignored");
            var separate=new NuzlockeJournal(folder,Guid.NewGuid());separate.Observe([ko],true);
            check(separate.Deaths==1&&journal.Deaths==2,"adventures isolated");
            journal.CorrectTotal(0);journal.Observe([ko,second],true);
            check(journal.Deaths==0,"manual correction preserves deduplication");
            journal=new NuzlockeJournal(folder,adventure);journal.Observe([second with {Pid=80}],true);
            check(journal.Deaths==1,"new death increments corrected total after restart");
            journal.Reset();check(journal.Deaths==0,"reset immediately clears total");
            journal=new NuzlockeJournal(folder,adventure);journal.Observe([ko],true);
            check(journal.Deaths==1,"reset cleared the persisted identities");
            var frame=new PartyFrame("paldea",[ko],[16,1,8,1]);
            var json=JsonSerializer.Serialize(DisplayFrame.From(adventure.ToString(),frame,1),new JsonSerializerOptions(JsonSerializerDefaults.Web));
            using var doc=JsonDocument.Parse(json);
            check(!json.Contains("pid",StringComparison.OrdinalIgnoreCase),"no PID in network payload");
            check(doc.RootElement.GetProperty("badges").EnumerateArray().Select(x=>x.GetInt32()).SequenceEqual([1,8,16]),"normalized non-linear badges");
            check(doc.RootElement.GetProperty("team")[0].GetProperty("hp").GetInt32()==0,"KO state retained in outbound team");
            var noProgress=JsonSerializer.Serialize(DisplayFrame.From(adventure.ToString(),frame with {Badges=null},null),new JsonSerializerOptions(JsonSerializerDefaults.Web));
            check(!noProgress.Contains("deaths")&&!noProgress.Contains("badges"),"unavailable progress omitted, not reset to empty");
            var saved=frame with {Team=[ko with {Hp=65}],Badges=[7,1]};
            var live=frame with {Badges=null};
            var merged=ProgressionPolicy.WithSavedBadges(live,saved);
            check(ReferenceEquals(merged.Team,live.Team)&&merged.Badges!.SequenceEqual([7,1]),"save badges retain live KO party");
            check(ProgressionPolicy.WithSavedBadges(live,saved with {Game="sinnoh"})==live,"different game rejected");
            check(ProgressionPolicy.WithSavedBadges(live,saved with {Team=[ko with {Pid=99}]})==live,"different trainer save rejected");
            File.WriteAllText(file,"{bad-json");
            try {new NuzlockeJournal(folder,adventure);check(false,"corrupt history accepted");}
            catch(InvalidDataException){check(File.ReadAllText(file)=="{bad-json","corrupt history preserved, never reset");}
        } finally {Directory.Delete(folder,true);}
    }
}
