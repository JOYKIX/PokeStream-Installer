using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
namespace PokeStream.Connect;

public static class GameIdentity {
    private static readonly (string Key,string[] Names)[] Families=[
        ("bdsp",["Diamant Étincelant","Perle Scintillante","Brilliant Diamond","Shining Pearl"]),
        ("oras",["Rubis Oméga","Saphir Alpha","Omega Ruby","Alpha Sapphire"]),
        ("usum",["Ultra-Soleil","Ultra-Lune","Ultra Sun","Ultra Moon"]),
        ("hgss",["HeartGold","SoulSilver"]),("b2w2",["Noir 2","Blanc 2","Black 2","White 2"]),
        ("frlg",["Rouge Feu","Vert Feuille","FireRed","LeafGreen"]),
        ("letsgo",["Let’s Go","Let's Go"]),("pla",["Arceus"]),
        ("sv",["Écarlate","Violet","Scarlet"]),("sw",["Épée","Sword"]),("sh",["Bouclier","Shield"]),
        ("xy",["X · Y","Pokémon X","Pokemon X","Pokémon Y","Pokemon Y"]),
        ("sm",["Soleil","Lune","Sun","Moon"]),("pt",["Platine","Platinum"]),
        ("dp",["Diamant","Perle","Diamond","Pearl"]),("bw",["Noir","Blanc","Black","White"]),
        ("emerald",["Émeraude","Emerald"]),("rs",["Rubis","Saphir","Ruby","Sapphire"]),
        ("crystal",["Cristal","Crystal"]),("gs",["Or","Argent","Gold","Silver"]),
        ("yellow",["Jaune","Yellow"]),("rb",["Rouge","Bleu","Red","Blue"])
    ];
    public static string? FromVersion(string code)=>code switch {
        "RD" or "GN" or "BU" or "RB" or "RBY"=>"rb","YW"=>"yellow","GD" or "SI" or "GS"=>"gs","C"=>"crystal",
        "R" or "S" or "RS"=>"rs","E"=>"emerald","FR" or "LG" or "FRLG"=>"frlg",
        "D" or "P" or "DP"=>"dp","Pt"=>"pt","HG" or "SS" or "HGSS"=>"hgss","B" or "W" or "BW"=>"bw","B2" or "W2" or "B2W2"=>"b2w2",
        "X" or "Y" or "XY"=>"xy","OR" or "AS" or "ORAS"=>"oras","SN" or "MN" or "SM"=>"sm","US" or "UM" or "USUM"=>"usum",
        "GP" or "GE" or "GG"=>"letsgo","SW"=>"sw","SH"=>"sh","BD" or "SP" or "BDSP"=>"bdsp","PLA"=>"pla","SL" or "VL" or "SV"=>"sv",_=>null};
    public static string? FromName(string text) {
        string Clean(string s)=>new(s.Normalize(NormalizationForm.FormD).Where(c=>CharUnicodeInfo.GetUnicodeCategory(c)!=UnicodeCategory.NonSpacingMark).ToArray());
        var normalized=Clean(text);
        foreach(var (key,names) in Families) if(names.Any(n=>Regex.IsMatch(normalized,@"(?<!\p{L})"+Regex.Escape(Clean(n))+@"(?!\p{L})",RegexOptions.IgnoreCase|RegexOptions.CultureInvariant)))return key;
        return null;
    }
    public static bool Supports(string emulator,string key)=>emulator switch {
        "Citra" or "Azahar"=>key is "xy" or "oras" or "sm" or "usum",
        "Ryujinx" or "Citron"=>key is "letsgo" or "sw" or "sh" or "bdsp" or "pla" or "sv",
        "mGBA"=>key is "rb" or "yellow" or "gs" or "crystal" or "rs" or "emerald" or "frlg",
        "melonDS" or "DeSmuME"=>key is "dp" or "pt" or "hgss" or "bw" or "b2w2",_=>false};
}
