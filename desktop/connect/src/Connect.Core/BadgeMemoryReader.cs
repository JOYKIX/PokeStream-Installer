using System.Buffers.Binary;
namespace PokeStream.Connect;
public sealed record BadgeMemoryProfile(uint Address,uint Pointer=0,int FirstBit=0);
public static class BadgeMemoryReader {
    // Verified original ROM profiles only; see SOURCES.md.
    public static BadgeMemoryProfile? Gba(string code,int revision)=>code switch {
        "BPEE" when revision==0=>new(0x1270+(0x867/8),0x03005D8C,0x867%8),
        "BPRE" or "BPGE" when revision<=1=>new(0xEE0+(0x820/8),0x03005008),
        "BPRF" when revision==0=>new(0xEE0+(0x820/8),0x03004F58),
        "AXVE" or "AXPE" when revision<=2=>new(0x02025734+0x1220+(0x807/8),0,0x807%8),
        _=>null
    };
    public static BadgeMemoryProfile? Gb(uint partyCount)=>partyCount switch {
        0xD163=>new(0xD356),0xD162=>new(0xD355),0xDA22=>new(0xD57C),0xDCD7=>new(0xD857),_=>null
    };
    public static int[]? Read(BadgeMemoryProfile? profile,Func<uint,int,byte[]> read) {
        if(profile==null)return null;
        try {
            uint address=profile.Address,baseAddress=0;
            if(profile.Pointer!=0) {
                baseAddress=BinaryPrimitives.ReadUInt32LittleEndian(read(profile.Pointer,4));
                if(baseAddress<0x02000000 || baseAddress+address+2>0x02040000)return null;
                address=checked(baseAddress+address);
            }
            int length=profile.FirstBit==0?1:2;
            var first=read(address,length);
            if(!first.AsSpan().SequenceEqual(read(address,length)))return null;
            if(profile.Pointer!=0 && baseAddress!=BinaryPrimitives.ReadUInt32LittleEndian(read(profile.Pointer,4)))return null;
            int bits=(first[0]|(length==2?first[1]<<8:0))>>profile.FirstBit;
            return Enumerable.Range(0,8).Where(i=>(bits&(1<<i))!=0).ToArray();
        }catch(Exception e)when(e is IOException or InvalidDataException or OverflowException){return null;}
    }
}
