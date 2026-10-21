using System.Buffers.Binary;
using System.Text;
namespace PokeStream.Connect;
public record PartyMember(int Species, string Nickname, int Level, bool Shiny, bool Egg, int Hp, int MaxHp, uint? Pid = null, int? HeldItem = null, int? Gender = null, int? Form = null, uint? TrainerId = null, int? Generation = null, GameTypes? Types = null);
public record PartyFrame(string Game, PartyMember[] Team, int[]? Badges = null, bool BadgesFromSave = false, bool InBattle = false, [property:System.Text.Json.Serialization.JsonIgnore] PartyMember[]? FieldTeam = null);
public static class PartyDecoder
{
    // Each row identifies the location of logical blocks A/B/C/D in the shuffled data.
    private static readonly string[] Orders = ["ABCD","ABDC","ACBD","ACDB","ADBC","ADCB","BACD","BADC","BCAD","BCDA","BDAC","BDCA","CABD","CADB","CBAD","CBDA","CDAB","CDBA","DABC","DACB","DBAC","DBCA","DCAB","DCBA"];
    private static ushort U16(byte[] b,int i)=>BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(i));
    private static uint U32(byte[] b,int i)=>BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(i));
    public static void Crypt(Span<byte> data, uint seed) {
        for(int i=0;i<data.Length;i+=2) {seed=unchecked(seed*0x41C64E6D+0x6073);ushort value=(ushort)(BinaryPrimitives.ReadUInt16LittleEndian(data[i..])^(seed>>16));BinaryPrimitives.WriteUInt16LittleEndian(data[i..],value);}
    }
    public static PartyMember Decode(byte[] source,int generation) {
        if(generation is not (4 or 5) || source.Length!=(generation==4?236:220)) throw new InvalidDataException("Taille Pokémon invalide.");
        uint pid=U32(source,0); var raw=(byte[])source.Clone();
        // Runtime menus can hold the body and party stats decrypted independently.
        // Block order is still determined by PID, even while the data is plaintext.
        ushort flags=U16(raw,4);
        if((flags&~3)!=0)throw new InvalidDataException("Pokémon en cours de mise à jour.");
        if((flags&2)==0)Crypt(raw.AsSpan(8,128),U16(raw,6));
        if((flags&1)==0)Crypt(raw.AsSpan(136),pid);
        var data=Unshuffle(raw,pid);
        if(!ValidChecksum(data)) throw new InvalidDataException("Équipe en cours de mise à jour.");
        int species=U16(data,8),level=data[0x8C],hp=U16(data,0x8E),max=U16(data,0x90);
        if(species<1||species>(generation==4?493:649)||level<1||level>100||max<1||max>999||hp>max) throw new InvalidDataException("Données Pokémon incomplètes.");
        uint ivs=U32(data,0x38);bool egg=(ivs&0x40000000)!=0;
        bool shiny=((pid>>16)^(pid&0xffff)^U16(data,0x0C)^U16(data,0x0E))<8;
        string name=(ivs&0x80000000)!=0?Nickname(data,generation):"";
        return new(species,name,level,shiny,egg,hp,max,pid,U16(data,0x0A),(data[0x40]>>1)&3,data[0x40]>>3,U32(data,0x0C),generation);
    }
    public static PartyMember DecodeBattle(byte[] box,int generation,int level,int hp,int maxHp) {
        if(box.Length!=136)throw new InvalidDataException("Pokémon de combat incomplet.");
        var party=new byte[generation==4?236:220];box.CopyTo(party,0);
        // The caller supplies already decoded runtime stats; keep the box encryption flag.
        BinaryPrimitives.WriteUInt16LittleEndian(party.AsSpan(4),(ushort)(U16(box,4)|1));
        party[0x8C]=checked((byte)level);
        BinaryPrimitives.WriteUInt16LittleEndian(party.AsSpan(0x8E),checked((ushort)hp));
        BinaryPrimitives.WriteUInt16LittleEndian(party.AsSpan(0x90),checked((ushort)maxHp));
        return Decode(party,generation);
    }
    private static byte[] Unshuffle(byte[] raw,uint pid) {
        var result=(byte[])raw.Clone();string order=Orders[((pid>>13)&31)%24];
        for(int i=0;i<4;i++) Array.Copy(raw,8+i*32,result,8+(order[i]-'A')*32,32);
        return result;
    }
    private static bool ValidChecksum(byte[] b) {int sum=0;for(int i=8;i<136;i+=2)sum+=U16(b,i);return (ushort)sum==U16(b,6);}
    private static string Nickname(byte[] b,int gen) {
        var s=new StringBuilder();
        for(int i=0;i<10;i++){ushort c=U16(b,0x48+i*2);if(c==0xffff||c==0)break;char value=gen==5?(char)c:Gen4Char(c);if(char.IsControl(value)||char.IsSurrogate(value))value='?';s.Append(value);}
        return s.ToString();
    }
    private static char Gen4Char(ushort c) {
        if(c>=0x121&&c<=0x12A)return (char)('0'+c-0x121);
        if(c>=0x12B&&c<=0x144)return (char)('A'+c-0x12B);
        if(c>=0x145&&c<=0x15E)return (char)('a'+c-0x145);
        if(c>=0x15F&&c<=0x19E)return c is 0x176 or 0x196?'?':(char)(0xC0+c-0x15F);
        return c switch {0x19F=>'Œ',0x1A0=>'œ',0x1DE=>' ',0x1AB=>'!',0x1AC=>'?',0x1AD=>',',0x1AE=>'.',0x1B3=>'\'',0x1BB=>'♂',0x1BC=>'♀',0x1BE=>'-',_=>'?'};
    }
    public static PartyFrame ParseFrame(string text,DateTimeOffset now) {
        if(text.Length>4000)throw new InvalidDataException("Trame trop grande.");
        var lines=text.Replace("\r","").TrimEnd('\n').Split('\n');
        if(lines.Length<4||lines.Length>9||lines[0]!="POKESTREAM/1")throw new InvalidDataException("Trame invalide.");
        var code=lines[1];
        if(code.Length!=4||code[3] is not ('E' or 'F' or 'O'))throw new InvalidDataException("Version non prise en charge.");
        string game=code[..3] switch {"ADA" or "APA" or "CPU"=>"sinnoh","IPK" or "IPG"=>"johto","IRA" or "IRB"=>"unova","IRD" or "IRE"=>"unova2",_=>throw new InvalidDataException("Jeu non pris en charge.")};
        if(!long.TryParse(lines[2],out long seconds)||Math.Abs(now.ToUnixTimeSeconds()-seconds)>8)throw new InvalidDataException("En attente du jeu.");
        int gen=game is "unova" or "unova2"?5:4;
        var team=lines.Skip(3).Select(line=>Decode(Convert.FromHexString(line),gen)).ToArray();
        if(team.Length is <1 or >6)throw new InvalidDataException("Équipe invalide.");
        return new(game,team);
    }
}
