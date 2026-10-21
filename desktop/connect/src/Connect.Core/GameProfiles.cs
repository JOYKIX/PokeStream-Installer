using System.Buffers.Binary;
using System.Text;
namespace PokeStream.Connect;

public record GameProfile(string Code, string Name, string Region, int Generation, uint Pointer, uint Address) {
    public int SlotSize => Generation == 4 ? 236 : 220;
}

public static class GameProfiles {
    public const uint HeaderAddress = 0x02FFFE0C;
    public static readonly GameProfile[] All = [
        new("ADAE","Diamant","sinnoh",4,0x02106FAC,0xD2AC), new("APAE","Perle","sinnoh",4,0x02106FAC,0xD2AC),
        new("ADAF","Diamant","sinnoh",4,0x0210712C,0xD2AC), new("APAF","Perle","sinnoh",4,0x0210712C,0xD2AC),
        new("CPUE","Platine","sinnoh",4,0x02101D2C,0xD094), new("CPUF","Platine","sinnoh",4,0x02101F0C,0xD094),
        new("IPKE","HeartGold","johto",4,0x0211186C,0xD088), new("IPGE","SoulSilver","johto",4,0x0211186C,0xD088),
        new("IPKF","HeartGold","johto",4,0x0211188C,0xD088), new("IPGF","SoulSilver","johto",4,0x0211188C,0xD088),
        new("IRBO","Noir","unova",5,0,0x022349B4), new("IRAO","Blanc","unova",5,0,0x022349D4),
        new("IRBF","Noir","unova",5,0,0x02234934), new("IRAF","Blanc","unova",5,0,0x02234954),
        new("IREO","Noir 2","unova2",5,0,0x0221E3EC), new("IRDO","Blanc 2","unova2",5,0,0x0221E42C),
        new("IREF","Noir 2","unova2",5,0,0x0221E40C), new("IRDF","Blanc 2","unova2",5,0,0x0221E42C)
    ];
    private static readonly Dictionary<uint,GameProfile> Codes = All.ToDictionary(p => BinaryPrimitives.ReadUInt32LittleEndian(Encoding.ASCII.GetBytes(p.Code)));
    public static GameProfile? FromCode(ReadOnlySpan<byte> code) => code.Length >= 4 ? Codes.GetValueOrDefault(BinaryPrimitives.ReadUInt32LittleEndian(code)) : null;
    public static IEnumerable<(int Offset,GameProfile Profile)> FindHeaders(byte[] bytes,int length,ulong address) {
        // Older 32-bit DeSmuME builds only guarantee word alignment.
        int first=(int)((4-address%4)%4);
        for(int i=first;i+4<=length;i+=4) {
            if(bytes[i] is not (65 or 67 or 73)) continue;
            if(i+7<=length && bytes[i+6] is not (0 or 2 or 3)) continue;
            var profile=FromCode(bytes.AsSpan(i,4));
            if(profile!=null) yield return (i,profile);
        }
    }
}

public static class DsPartyReader {
    public static PartyFrame Read(GameProfile profile,Func<uint,int,byte[]> read) {
        uint address=profile.Address,pointer=0;
        if(profile.Pointer!=0) {
            pointer=BinaryPrimitives.ReadUInt32LittleEndian(read(profile.Pointer,4));
            if(pointer<0x02000000 || pointer>=0x023F0000) throw new InvalidDataException("Partie en cours de chargement.");
            address=checked(pointer+address);
        }
        if(address<0x02000004 || address+6*profile.SlotSize>0x02400000) throw new InvalidDataException("Adresse équipe invalide.");
        int count=read(address-4,1)[0];
        if(count is <1 or >6) throw new InvalidDataException("En attente du premier Pokémon.");
        var bytes=read(address,count*profile.SlotSize);
        var team=new PartyMember[count];
        for(int i=0;i<count;i++) team[i]=PartyDecoder.Decode(bytes.AsSpan(i*profile.SlotSize,profile.SlotSize).ToArray(),profile.Generation);
        var badges=DsBadgeReader.Read(profile,read);
        // Never publish a mixture of two frames during a save-state load or party edit.
        if(read(address-4,1)[0]!=count)throw new InvalidDataException("Équipe en cours de mise à jour.");
        var second=read(address,bytes.Length);
        for(int i=0;i<count;i++) {
            var latest=PartyDecoder.Decode(second.AsSpan(i*profile.SlotSize,profile.SlotSize).ToArray(),profile.Generation);
            if(!PartyIdentity.Same(team[i],latest))throw new InvalidDataException("Équipe en cours de mise à jour.");
            team[i]=PartyIdentity.ConfirmZero(team[i],latest);
        }
        if(profile.Pointer!=0 && pointer!=BinaryPrimitives.ReadUInt32LittleEndian(read(profile.Pointer,4)))throw new InvalidDataException("Partie en cours de chargement.");
        var frame=BattlePartyReader.ReadDs(new(profile.Region,team,badges),profile,address,read);
        if(read(address-4,1)[0]!=count || profile.Pointer!=0 && pointer!=BinaryPrimitives.ReadUInt32LittleEndian(read(profile.Pointer,4)))
            throw new InvalidDataException("Partie en cours de chargement.");
        for(int i=0;i<count;i++)if(BinaryPrimitives.ReadUInt32LittleEndian(read(address+(uint)(i*profile.SlotSize),4))!=team[i].Pid)
            throw new InvalidDataException("Équipe en cours de réorganisation.");
        return frame;
    }
}
