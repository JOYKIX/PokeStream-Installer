// SPDX-License-Identifier: GPL-3.0-or-later
// Standalone, read-only save-file to JSON converter. No network or emulator access.
using System.Text.Json;
using System.Text.Json.Serialization;
using PKHeX.Core;

try {
    if(args.Length!=1) throw new InvalidDataException("Choisis une sauvegarde.");
    var info=new FileInfo(args[0]);
    if(!info.Exists || info.Length is <512 or >8388608) throw new InvalidDataException("Sauvegarde non prise en charge.");
    byte[] bytes;
    using(var file=new FileStream(info.FullName,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete)) {
        bytes=new byte[file.Length];file.ReadExactly(bytes);
        if(file.Length!=bytes.Length) throw new InvalidDataException("Sauvegarde en cours.");
    }
    var save=SaveUtil.GetVariantSAV(bytes) ?? throw new InvalidDataException("Format inconnu.");
    if(!save.ChecksumsValid) throw new InvalidDataException("Sauvegarde incomplète.");
    string game=save switch {
        SAV1=>"kanto",SAV2=>"johto",SAV3FRLG=>"kanto",SAV3=>"hoenn",
        SAV4HGSS=>"johto",SAV4=>"sinnoh",SAV5B2W2=>"unova2",SAV5=>"unova",
        SAV6AO=>"hoenn",SAV6XY=>"kalos",SAV7=>"alola",SAV7b=>"kanto",
        SAV8SWSH=>save.Version==GameVersion.SH?"galar-shield":"galar-sword",
        SAV8BS=>"sinnoh",SAV8LA=>"hisui",SAV9SV=>"paldea",
        _=>throw new InvalidDataException("Jeu non pris en charge.")
    };
    var party=save.PartyData;
    if(party.Count is <1 or >6) throw new InvalidDataException("Pas encore d’équipe.");
    var team=party.Select(p=>{
        if(!p.Valid || p.Species is <1 or >1025 || p.Stat_Level is <1 or >100 || p.Stat_HPMax is <1 or >999 || p.Stat_HPCurrent<0 || p.Stat_HPCurrent>p.Stat_HPMax)
            throw new InvalidDataException("Équipe incomplète.");
        return new Member((int)p.Species,p.IsNicknamed?p.Nickname:"",p.Stat_Level,p.IsShiny,p.IsEgg,p.Stat_HPCurrent,p.Stat_HPMax,save.Generation>=3?p.PID:null,save.Generation>=2 && save is not SAV7b && save is not SAV8LA?p.HeldItem:0,save.Generation>=2?p.Gender:2,p.Form,save.Generation>=3?p.ID32:null,save.Generation);
    }).ToArray();
    Console.WriteLine(JsonSerializer.Serialize(new Result(game,team,save.GetType().Name,save.Generation,save.Version.ToString(),BadgeReader.Read(save)),ReaderJson.Default.Result));
} catch(Exception e) when(e is not OutOfMemoryException && e is not StackOverflowException) {
    Console.WriteLine(JsonSerializer.Serialize(new ReaderError("Lecture impossible : sauvegarde incomplète ou non prise en charge."),ReaderJson.Default.ReaderError));
    Environment.ExitCode=2;
}

internal record Member(int Species,string Nickname,int Level,bool Shiny,bool Egg,int Hp,int MaxHp,uint? Pid,int? HeldItem,int? Gender,int? Form,uint? TrainerId,int? Generation);
internal record Result(string Game,Member[] Team,string Format,int Generation,string Version,int[]? Badges);
internal record ReaderError(string Error);
[JsonSourceGenerationOptions(PropertyNamingPolicy=JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(Result))]
[JsonSerializable(typeof(ReaderError))]
internal partial class ReaderJson:JsonSerializerContext {}
