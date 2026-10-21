using System.Buffers.Binary;
using System.Text;
namespace PokeStream.Connect;

// Independent read-only decoder for the fixed party fields used by the overlay.
public static class ModernPartyDecoder {
    private static readonly string[] Orders=["ABCD","ABDC","ACBD","ACDB","ADBC","ADCB","BACD","BADC","BCAD","BCDA","BDAC","BDCA","CABD","CADB","CBAD","CBDA","CDAB","CDBA","DABC","DACB","DBAC","DBCA","DCAB","DCBA"];
    private static ushort U16(byte[] b,int i)=>BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(i));
    private static uint U32(byte[] b,int i)=>BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(i));
    private static readonly int[] Gen9Shift=[65,-1,-1,-1,-1,31,31,47,47,29,29,53,31,31,46,44,30,30,-7,-7,-7,13,13,-2,-2,23,23,24,-21,-21,27,27,47,47,47,26,14,-33,-33,-33,-17,-17,3,-29,12,-12,-31,-31,-31,3,3,-24,-24,-44,-44,-30,-30,-28,-28,23,23,6,7,29,8,3,4,4,20,4,23,6,3,3,4,-1,13,9,7,5,7,9,9,-43,-43,-43,-68,-68,-68,-58,-58,-25,-29,-31,6,-1,6,0,0,0,3,3,4,2,3,3,-5,-12,-12];
    public static PartyMember? DecodeSwitch(byte[] encrypted,int generation,bool arceus=false,(int Level,int Hp,int MaxHp)? battle=null) {
        int stored=arceus?360:328,block=arceus?88:80;
        if(generation is not (8 or 9) || encrypted.Length!=stored+16)throw new InvalidDataException("Format Switch invalide.");
        if(encrypted.All(b=>b==0))return null;
        if(U16(encrypted,4)!=0)throw new InvalidDataException("Équipe en cours de mise à jour.");
        uint ec=U32(encrypted,0);var decoded=(byte[])encrypted.Clone();
        PartyDecoder.Crypt(decoded.AsSpan(8,stored-8),ec);PartyDecoder.Crypt(decoded.AsSpan(stored),ec);
        var data=(byte[])decoded.Clone();string order=Orders[((ec>>13)&31)%24];
        for(int i=0;i<4;i++)Array.Copy(decoded,8+i*block,data,8+(order[i]-'A')*block,block);
        int checksum=0;for(int i=8;i<stored;i+=2)checksum+=U16(data,i);
        if((ushort)checksum!=U16(data,6))throw new InvalidDataException("Équipe Switch instable.");
        int species=U16(data,8);if(species==0)return null;
        if(generation==9 && species>=917 && species-917<Gen9Shift.Length)species+=Gen9Shift[species-917];
        int level=battle?.Level??data[stored],hp=battle?.Hp??U16(data,arceus?0x92:0x8A),max=battle?.MaxHp??U16(data,stored+2);
        if(species<1||species>(generation==9?1025:arceus?905:898)||level is <1 or >100||max is <1 or >2047||hp<0||hp>max)throw new InvalidDataException("Pokémon Switch invalide.");
        uint iv=U32(data,arceus?0x94:0x8C),pid=U32(data,0x1C);
        bool shiny=((pid>>16)^(pid&65535)^U16(data,0xC)^U16(data,0xE))<16;
        var name=new StringBuilder();
        if((iv&0x80000000)!=0)for(int i=0;i<12;i++){char c=(char)U16(data,(arceus?0x60:0x58)+i*2);if(c is '\0' or '￿')break;name.Append(char.IsControl(c)||char.IsSurrogate(c)?'?':c);}
        int gender=(data[0x22]>>(generation==9?1:2))&3;
        if(gender>2)throw new InvalidDataException("Pokémon Switch en cours de mise à jour.");
        return new(species,name.ToString(),level,shiny,(iv&0x40000000)!=0,hp,max,pid,
            arceus?0:U16(data,0x0A),gender,data[0x24],U32(data,0x0C),generation);
    }
    public static PartyMember Decode3dsBattle(byte[] box,int level,int hp,int maxHp,int generation=6) {
        if(box.Length!=232)throw new InvalidDataException("Pokémon de combat incomplet.");
        var party=new byte[254];box.CopyTo(party,0);
        party[0xEC]=checked((byte)level);
        BinaryPrimitives.WriteUInt16LittleEndian(party.AsSpan(0xF0),checked((ushort)hp));
        BinaryPrimitives.WriteUInt16LittleEndian(party.AsSpan(0xF2),checked((ushort)maxHp));
        PartyDecoder.Crypt(party.AsSpan(232),U32(box,0));
        return Decode3ds(party,generation)??throw new InvalidDataException("Pokémon de combat absent.");
    }
    public static PartyMember? Decode3ds(byte[] encrypted,int generation) {
        if(generation is not (6 or 7) || encrypted.Length!=254)throw new InvalidDataException("Format 3DS invalide.");
        if(encrypted.All(b=>b==0))return null;
        if(U16(encrypted,4)!=0)throw new InvalidDataException("Équipe 3DS en cours de mise à jour.");
        uint ec=U32(encrypted,0);var decoded=(byte[])encrypted.Clone();
        PartyDecoder.Crypt(decoded.AsSpan(8,224),ec);PartyDecoder.Crypt(decoded.AsSpan(232),ec);
        var data=(byte[])decoded.Clone();string order=Orders[((ec>>13)&31)%24];
        for(int i=0;i<4;i++)Array.Copy(decoded,8+i*56,data,8+(order[i]-'A')*56,56);
        int checksum=0;for(int i=8;i<232;i+=2)checksum+=U16(data,i);
        if((ushort)checksum!=U16(data,6))throw new InvalidDataException("Équipe 3DS instable.");
        int species=U16(data,8);if(species==0)return null;
        int level=data[0xEC],hp=U16(data,0xF0),max=U16(data,0xF2);
        if(species>(generation==6?721:807)||level is <1 or >100||max is <1 or >999||hp>max)throw new InvalidDataException("Pokémon 3DS invalide.");
        uint iv=U32(data,0x74),pid=U32(data,0x18);
        bool shiny=((pid>>16)^(pid&65535)^U16(data,0xC)^U16(data,0xE))<16;
        var name=new StringBuilder();
        if((iv&0x80000000)!=0)for(int i=0;i<12;i++){char c=(char)U16(data,0x40+i*2);if(c is '\0' or '\uffff')break;name.Append(char.IsControl(c)||char.IsSurrogate(c)?'?':c);}
        return new(species,name.ToString(),level,shiny,(iv&0x40000000)!=0,hp,max,pid,U16(data,0x0A),(data[0x1D]>>1)&3,data[0x1D]>>3,U32(data,0x0C),generation);
    }
}

public record CitraProfile(string Name,string Region,int Generation,uint Address);
public static class CitraPartyReader {
    public static readonly CitraProfile[] Profiles=[new("X · Y","kalos",6,0x08CE1CE8),new("X · Y","kalos",6,0x08CE1CF8),new("Rubis Oméga · Saphir Alpha","hoenn",6,0x08CF727C),new("Rubis Oméga · Saphir Alpha (1.4)","hoenn",6,0x08CFB26C),new("Soleil · Lune","alola",7,0x34195E10),new("Ultra-Soleil · Ultra-Lune","alola",7,0x33F7FA44)];
    private static PartyFrame ReadOrdered(CitraProfile profile,Func<uint,int,byte[]> read,Func<uint,int,byte[]> readBattle) {
        // X/Y, OR/AS and Alola store six party-object pointers followed by the count.
        // Swaps reorder the pointers, not the physical records (SOURCES.md).
        uint table=checked(profile.Address-0x8C);
        byte[] Header(){var h=read(table,28);if(h.Length!=28)throw new InvalidDataException("Ordre de l’équipe indisponible.");return h;}
        var header=Header();int count=header[24];
        if(count is <1 or >6)throw new InvalidDataException("Équipe 3DS indisponible.");
        var addresses=new uint[count];var used=new HashSet<uint>();
        for(int i=0;i<addresses.Length;i++) {
            uint pointer=BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(i*4));
            if(!((pointer>=0x08000000 && pointer<=0x0FFFFE1C) || (pointer>=0x30000000 && pointer<=0x3FFFFE1C)) || pointer%4!=0 || !used.Add(pointer))
                throw new InvalidDataException("Équipe 3DS en cours de réorganisation.");
            addresses[i]=checked(pointer+0x40);
        }
        byte[] Capture() {
            var all=new byte[254*addresses.Length];
            for(int i=0;i<addresses.Length;i++) {
                var body=read(addresses[i],232);var stats=read(addresses[i]+344,22);
                if(body.Length!=232 || stats.Length!=22)throw new InvalidDataException("Lecture équipe incomplète.");
                body.CopyTo(all,254*i);stats.CopyTo(all,254*i+232);
            }
            return all;
        }
        PartyMember[] Decode(byte[] bytes)=>Enumerable.Range(0,addresses.Length).Select(i=>
            ModernPartyDecoder.Decode3ds(bytes.AsSpan(i*254,254).ToArray(),profile.Generation)
            ??throw new InvalidDataException("Équipe 3DS en cours de modification.")).ToArray();
        var team=Decode(Capture());
        // Only the used pointers and count describe slot order. Unused table bytes
        // and unrelated runtime fields can change without changing the overlay.
        bool SameOrder(byte[] next)=>next[24]==count && header.AsSpan(0,count*4).SequenceEqual(next.AsSpan(0,count*4));
        if(!SameOrder(Header()))throw new InvalidDataException("Équipe 3DS en cours de réorganisation.");
        var latest=Decode(Capture());
        if(!PartyIdentity.SameOrder(team,latest) || !SameOrder(Header()))
            throw new InvalidDataException("Équipe 3DS en cours de réorganisation.");
        PartyIdentity.ConfirmZeros(team,latest);
        var normal=new PartyFrame(profile.Region,latest);
        var frame=profile.Generation==7
            ? AlolaBattleReader.Read(normal,profile,readBattle)
            : profile.Region=="kalos"?BattlePartyReader.ReadXy(normal,readBattle):normal;
        if(!SameOrder(Header()))throw new InvalidDataException("Équipe 3DS en cours de réorganisation.");
        return frame;
    }
    public static PartyFrame Read(CitraProfile profile,Func<uint,int,byte[]> read,Func<uint,int,byte[]>? readBattle=null)
        =>ReadOrdered(profile,read,readBattle??read);
}
