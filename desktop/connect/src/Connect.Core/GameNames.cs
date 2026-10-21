namespace PokeStream.Connect;
public static class GameNames {
    public static string For(string code)=>code switch {
        "RD" or "GN" or "BU" or "RB" or "RBY"=>"Rouge · Bleu", "YW"=>"Jaune",
        "GD" or "SI" or "GS"=>"Or · Argent", "C"=>"Cristal", "R" or "S" or "RS"=>"Rubis · Saphir", "E"=>"Émeraude", "FR" or "LG" or "FRLG"=>"Rouge Feu · Vert Feuille",
        "D" or "P" or "DP"=>"Diamant · Perle", "Pt"=>"Platine", "HG" or "SS" or "HGSS"=>"HeartGold · SoulSilver", "B" or "W" or "BW"=>"Noir · Blanc", "B2" or "W2" or "B2W2"=>"Noir 2 · Blanc 2",
        "X" or "Y" or "XY"=>"X · Y", "OR" or "AS" or "ORAS"=>"Rubis Oméga · Saphir Alpha", "SN" or "MN" or "SM"=>"Soleil · Lune", "US" or "UM" or "USUM"=>"Ultra-Soleil · Ultra-Lune", "GP" or "GE" or "GG"=>"Let’s Go", "SW"=>"Épée", "SH"=>"Bouclier", "BD" or "SP" or "BDSP"=>"Diamant Étincelant · Perle Scintillante", "PLA"=>"Légendes Arceus", "SL" or "VL" or "SV"=>"Écarlate · Violet",_=>"Pokémon"};
}
