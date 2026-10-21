using System.Buffers.Binary;
namespace PokeStream.Connect;

// Read-only combat snapshots. Layout references and regional limitations: SOURCES.md.
public static class BattlePartyReader {
    private static ushort U16(byte[] b,int i)=>BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(i));
    private static uint U32(byte[] b,int i)=>BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(i));
    private static bool Ram(uint p,int length)=>p>=0x02000000 && p<=0x02400000-length && (p&3)==0;
    private static bool XyRam(uint p,int length)=>p>=0x081F0000 && p<=0x08210000-length && (p&3)==0;
    private static byte[] Bytes(Func<uint,int,byte[]> read,uint address,int length) {
        var bytes=read(address,length);
        if(bytes.Length!=length)throw new InvalidDataException("Lecture de combat incomplète.");
        return bytes;
    }
    private static uint[] Pointers(byte[] header,int offset,Func<uint,int,bool> valid,bool byteCount=false) {
        uint count=byteCount?header[offset+24]:U32(header,offset+24);
        if(count is <1 or >6)throw new InvalidDataException("Combat indisponible.");
        var pointers=new uint[count];
        for(int i=0;i<count;i++) {
            uint pointer=U32(header,offset+i*4);
            if(!valid(pointer,32) || pointers.Take(i).Contains(pointer))throw new InvalidDataException("Combat en cours de chargement.");
            pointers[i]=pointer;
        }
        return pointers;
    }
    private static void ValidStats(int species,int level,int hp,int maxHp,int item) {
        if(species is <1 or >721 || level is <1 or >100 || maxHp is <1 or >999 || hp<0 || hp>maxHp || item is <0 or >4095)
            throw new InvalidDataException("Statistiques de combat en cours de mise à jour.");
    }
    public static PartyFrame ReadXy(PartyFrame normal,Func<uint,int,byte[]> read) {
        const uint table=0x081FB284;
        try {
            var header=Bytes(read,table,112);
            var own=Pointers(header,0,XyRam);
            if(own.Length!=normal.Team.Length)return normal;
            // Validate a second participant, but never decode or transmit its Pokémon.
            Pointers(header,28,XyRam);
            PartyMember[] Capture()=>own.Select(pointer=>{
                var stats=Bytes(read,pointer,32);
                uint wrapper=U32(stats,0);
                if(!XyRam(wrapper,8))throw new InvalidDataException("Combat indisponible.");
                uint box=U32(Bytes(read,wrapper,8),4);
                if(!XyRam(box,232))throw new InvalidDataException("Combat indisponible.");
                int species=U16(stats,12),max=U16(stats,14),hp=U16(stats,16),item=U16(stats,18),level=stats[24];
                ValidStats(species,level,hp,max,item);
                var member=ModernPartyDecoder.Decode3dsBattle(Bytes(read,box,232),level,hp,max);
                // Transform/Illusion must not replace the underlying party identity.
                if(member.Species!=species)throw new InvalidDataException("Transformation de combat en cours.");
                if(U32(Bytes(read,pointer,4),0)!=wrapper || U32(Bytes(read,wrapper,8),4)!=box)
                    throw new InvalidDataException("Changement de combattant en cours.");
                return member with {HeldItem=item,Types=XyRam(pointer,0x1E6)?GameTypes.Read(read,pointer+0x1E4,6):null};
            }).ToArray();
            var first=Capture();var latest=Capture();
            if(!PartyIdentity.SameOrder(first,latest) || !header.AsSpan().SequenceEqual(Bytes(read,table,112)))return normal;
            PartyIdentity.ConfirmZeros(first,latest);
            GameTypes.Confirm(first,latest);
            return PartyIdentity.Merge(normal.Team,latest,out var merged)?normal with {Team=merged,InBattle=true,FieldTeam=normal.Team}:normal;
        }catch(Exception e)when(e is InvalidDataException or IOException){return normal;}
    }
    private static bool BattleActive(Func<uint,int,byte[]> read,uint address)=>U16(Bytes(read,address,2),0) is 0x2100 or 0x2101;
    public static PartyFrame ReadDs(PartyFrame normal,GameProfile profile,uint partyAddress,Func<uint,int,byte[]> read) {
        try {
            return profile.Generation==4?ReadDs4(normal,profile,partyAddress,read):ReadDs5(normal,profile,partyAddress,read);
        }catch(Exception e)when(e is InvalidDataException or IOException){return normal;}
    }
    private static PartyFrame ReadDs5(PartyFrame normal,GameProfile profile,uint partyAddress,Func<uint,int,byte[]> read) {
        bool sequel=profile.Region=="unova2";
        uint status=sequel
            ? checked((uint)(0x021B5138L+partyAddress-0x0221E42CL))
            : checked((uint)(0x021D0798L+partyAddress-0x022349B4L));
        if(!BattleActive(read,status))return normal;
        uint table=partyAddress+(sequel?0x38F80u:0x34E84u);
        // B/W and B2/W2 share the six-pointer BtlParty layout. Anchoring to the
        // recognized language's party avoids assuming one English RAM base for all ROMs.
        var header=Bytes(read,table,56);
        // DS BattleParty stores the count as u8, followed by the number of active positions.
        var own=Pointers(header,0,Ram,true);Pointers(header,28,Ram,true);
        if(own.Length!=normal.Team.Length)return normal;
        PartyMember[] Capture()=>own.Select(pointer=>{
            var stats=Bytes(read,pointer,32);uint box=U32(stats,0);
            if(!Ram(box,136))throw new InvalidDataException("Combat indisponible.");
            int species=U16(stats,12),max=U16(stats,14),hp=U16(stats,16),level=stats[24];
            int item=U16(stats,18);ValidStats(species,level,hp,max,item);
            var member=PartyDecoder.DecodeBattle(Bytes(read,box,136),5,level,hp,max);
            if(member.Species!=species || U32(Bytes(read,pointer,4),0)!=box)throw new InvalidDataException("Changement de combattant en cours.");
            // BattleMonCore 0xEC + BattleMonBase type pair 0x0C (SOURCES.md).
            return member with {HeldItem=item,Types=Ram(pointer,0xFA)?GameTypes.Read(read,pointer+0xF8,5):null};
        }).ToArray();
        var first=Capture();var latest=Capture();
        if(!BattleActive(read,status) || !PartyIdentity.SameOrder(first,latest) || !header.AsSpan().SequenceEqual(Bytes(read,table,56)))return normal;
        PartyIdentity.ConfirmZeros(first,latest);
        GameTypes.Confirm(first,latest);
        return PartyIdentity.Merge(normal.Team,latest,out var merged)?normal with {Team=merged,InBattle=true,FieldTeam=normal.Team}:normal;
    }
    private static PartyFrame ReadDs4(PartyFrame normal,GameProfile profile,uint partyAddress,Func<uint,int,byte[]> read) {
        bool hgss=profile.Region=="johto",platinum=profile.Code.StartsWith("CPU",StringComparison.Ordinal);
        uint statusBase=hgss?0x02246F48u:platinum?0x0224A55Au:0x0223BB38u;
        uint englishPointer=hgss?0x0211186Cu:platinum?0x02101D2Cu:0x02106FACu;
        uint status=checked(statusBase+profile.Pointer-englishPointer);
        if(!BattleActive(read,status))return normal;
        uint normalOffset=hgss?0xA8u:platinum?0xB4u:0x2ACu;
        uint heap=partyAddress-normalOffset;
        uint copy=heap+(hgss?0x4EA98u:platinum?0x4B8ACu:0x4C7D8u);
        uint active=heap+(hgss?0x49E7Cu:platinum?0x47620u:0x485E8u)-0x68;
        if(!Ram(copy,normal.Team.Length*236) || !Ram(active,0x240))return normal;
        PartyMember[] Capture() {
            var bytes=Bytes(read,copy,normal.Team.Length*236);
            var team=Enumerable.Range(0,normal.Team.Length).Select(i=>PartyDecoder.Decode(bytes.AsSpan(i*236,236).ToArray(),4)).ToArray();
            if(!PartyIdentity.Merge(normal.Team,team,out _))throw new InvalidDataException("Équipe de combat indisponible.");
            // Active battlers are interleaved player/opponent/player/opponent (0xC0).
            for(int i=0;i<2;i++) {
                uint address=active+(uint)(i*0x180);var b=Bytes(read,address,0x80);
                uint pid=U32(b,0x68),trainer=U32(b,0x74);
                int index=Array.FindIndex(team,p=>p.Pid==pid && p.TrainerId==trainer && p.Species==U16(b,0) && !p.Egg);
                if(index<0)continue;
                int hp=BinaryPrimitives.ReadInt32LittleEndian(b.AsSpan(0x4C));uint max=U32(b,0x50);
                if(max>999)throw new InvalidDataException("Combat indisponible.");
                ValidStats(U16(b,0),b[0x34],hp,(int)max,U16(b,0x78));
                if(U32(Bytes(read,address+0x68,4),0)!=pid)throw new InvalidDataException("Changement de combattant en cours.");
                team[index]=team[index] with {Hp=hp,MaxHp=(int)max,Level=b[0x34],HeldItem=U16(b,0x78),Form=b[0x26]&31,Types=GameTypes.Decode(b[0x24],b[0x25],4)};
            }
            return team;
        }
        var first=Capture();var latest=Capture();
        if(!BattleActive(read,status) || !PartyIdentity.SameOrder(first,latest))return normal;
        PartyIdentity.ConfirmZeros(first,latest);
        GameTypes.Confirm(first,latest);
        return PartyIdentity.Merge(normal.Team,latest,out var merged)?normal with {Team=merged,InBattle=true,FieldTeam=normal.Team}:normal;
    }
}
