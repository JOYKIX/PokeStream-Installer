using System.Buffers.Binary;
namespace PokeStream.Connect;

// Gen VII battle data is separate from the overworld party. All reads are
// bounded, read-only and matched to the player's complete team before use.
public static class AlolaBattleReader {
    private const uint Table=0x30000404;
    private static readonly byte[] UltraBattleMarker=Convert.FromHexString("4455000020030000FC260030682A0030");
    private static uint U32(byte[] b,int i)=>BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(i));
    private static int U16(byte[] b,int i)=>BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(i));
    private static byte[] Bytes(Func<uint,int,byte[]> read,uint address,int length) {
        var result=read(address,length);
        if(result.Length!=length)throw new InvalidDataException("Lecture de combat incomplète.");
        return result;
    }
    private static bool BattlePointer(uint pointer)=>pointer>=0x30000000 && pointer<=0x30010000-0x330 && (pointer&3)==0;
    private static bool PartyPointer(uint pointer)=>pointer>=0x30000000 && pointer<=0x40000000-0x1E4 && (pointer&3)==0;
    private static bool Active(CitraProfile profile,Func<uint,int,byte[]> read)=>GameIdentity.FromName(profile.Name) switch {
        "sm"=>U32(Bytes(read,0x30000158,4),0)==0x40001,
        "usum"=>Bytes(read,0x30002738,16).AsSpan().SequenceEqual(UltraBattleMarker),
        _=>false
    };
    private static uint[] Pointers(byte[] header,int offset) {
        uint count=U32(header,offset+24);
        if(count is <1 or >6)throw new InvalidDataException("Combat en cours de chargement.");
        var pointers=new uint[count];
        for(int i=0;i<count;i++) {
            uint pointer=U32(header,offset+i*4);
            if(!BattlePointer(pointer) || pointers.Take(i).Contains(pointer))
                throw new InvalidDataException("Ordre de combat indisponible.");
            pointers[i]=pointer;
        }
        return pointers;
    }
    private static bool SameTable(byte[] first,byte[] latest) {
        // Unused slots are not part of the order and can retain old pointers.
        for(int side=0;side<4;side++) {
            int offset=side*28;uint count=U32(first,offset+24);
            if(count>6 || count!=U32(latest,offset+24) ||
                !first.AsSpan(offset,(int)count*4).SequenceEqual(latest.AsSpan(offset,(int)count*4)))return false;
        }
        return true;
    }
    public static PartyFrame Read(PartyFrame normal,CitraProfile profile,Func<uint,int,byte[]> read) {
        try {
            if(!Active(profile,read))return normal;
            var header=Bytes(read,Table,112);
            var own=Pointers(header,0);
            if(own.Length!=normal.Team.Length)return normal;
            // Validate the participants, never read the opponents' Pokémon.
            bool other=false;
            for(int side=1;side<4;side++)if(U32(header,side*28+24)!=0){Pointers(header,side*28);other=true;}
            if(!other)return normal;
            PartyMember[] Capture()=>own.Select(pointer=>{
                var stats=Bytes(read,pointer,32);
                uint party=U32(stats,0);
                if(!PartyPointer(party))throw new InvalidDataException("Pokémon de combat indisponible.");
                int species=U16(stats,12),max=U16(stats,14),hp=U16(stats,16),item=U16(stats,18),level=stats[24];
                if(species is <1 or >807 || max is <1 or >999 || hp>max || level is <1 or >100 || item>4095)
                    throw new InvalidDataException("Statistiques de combat en cours de mise à jour.");
                // Gen VII points directly at the party object; its PK7 is +0x40.
                // Re-read it each frame so form changes are not frozen in a cache.
                var member=ModernPartyDecoder.Decode3dsBattle(Bytes(read,party+0x40,232),level,hp,max,7);
                if(member.Species!=species || U32(Bytes(read,pointer,4),0)!=party)
                    throw new InvalidDataException("Changement de combattant en cours.");
                return member with {HeldItem=item,Types=GameTypes.Read(read,pointer+0x1E4,7)};
            }).ToArray();
            var first=Capture();var latest=Capture();
            if(!PartyIdentity.SameOrder(first,latest) || !SameTable(header,Bytes(read,Table,112)) || !Active(profile,read))return normal;
            // A transient zero during a swap must not count as a Nuzlocke death.
            PartyIdentity.ConfirmZeros(first,latest);
            GameTypes.Confirm(first,latest);
            return PartyIdentity.Merge(normal.Team,latest,out var merged)
                ? normal with {Team=merged,InBattle=true,FieldTeam=normal.Team}:normal;
        }catch(Exception e)when(e is InvalidDataException or IOException){return normal;}
    }
}
