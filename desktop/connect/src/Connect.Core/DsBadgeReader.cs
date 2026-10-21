using System.Buffers.Binary;
namespace PokeStream.Connect;

// DS memory addresses are game/language specific. Unknown layouts retain the save fallback.
public static class DsBadgeReader {
    private sealed record Profile(uint Address,uint Pointer=0,bool Trainer=false);
    private static Profile? For(string code)=>code switch {
        "ADAE" or "APAE"=>new(0x292,0x021C59C8,true),
        "ADAF" or "APAF"=>new(0x292,0x021C5B48,true),
        "CPUE"=>new(0x96,0x021C0794,true),
        "CPUF"=>new(0x96,0x021C0974,true),
        "IPKE" or "IPGE"=>new(0x8E,0x021D2228,true),
        "IPKF" or "IPGF"=>new(0x8E,0x021D2248,true),
        "IRBO" or "IRAO" or "IRBF" or "IRAF"=>new(0x21AC0,0x02000024),
        "IREO"=>new(0x022266E8),
        "IRDO" or "IRDF"=>new(0x02226728),
        "IREF"=>new(0x02226708),
        _=>null
    };
    public static int[]? Read(GameProfile game,Func<uint,int,byte[]> read) {
        var profile=For(game.Code);if(profile==null)return null;
        try {
            uint basis=0,address=profile.Address;
            if(profile.Pointer!=0) {
                basis=BinaryPrimitives.ReadUInt32LittleEndian(read(profile.Pointer,4));
                if(basis<0x02000000 || basis>=0x02400000)return null;
                address=checked(basis+address);
            }
            int prefix=profile.Trainer?10:4;
            if(address<0x02000000+prefix || address>=0x02400000)return null;
            uint start=address-(uint)prefix;
            var data=read(start,prefix+1);
            if(data.Length!=prefix+1 || !data.AsSpan().SequenceEqual(read(start,data.Length)))return null;
            if(profile.Pointer!=0 && basis!=BinaryPrimitives.ReadUInt32LittleEndian(read(profile.Pointer,4)))return null;
            // Reject uninitialised/different trainer structures during loading.
            if(profile.Trainer && (data[8]>1 || data[9]!=(game.Code[3]=='F'?3:2)))return null;
            uint money=BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(profile.Trainer?4:0));
            if(money>9_999_999)return null;
            int flags=data[prefix];
            return Enumerable.Range(0,8).Where(i=>(flags&(1<<i))!=0).ToArray();
        }catch(Exception e)when(e is IOException or InvalidDataException or OverflowException){return null;}
    }
}
