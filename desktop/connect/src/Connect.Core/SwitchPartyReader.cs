using System.Buffers.Binary;
namespace PokeStream.Connect;
public record SwitchProfile(ulong TitleId,string Version,string Name,string Game,int Generation,string Layout,ulong Offset);
public static class SwitchPartyReader {
    public static readonly SwitchProfile[] Profiles=CreateProfiles();
    private static SwitchProfile[] CreateProfiles() {
        var result=new List<SwitchProfile>{
            new(0x0100ABF008968000,"1.3.2","Épée","galar-sword",8,"swsh",0x450C68B0),
            new(0x01008DB008C2C000,"1.3.2","Bouclier","galar-shield",8,"swsh",0x450C68B0),
            new(0x01001F5010DFA000,"1.1.1","Légendes Arceus","hisui",8,"pla",0x42A7000),
            new(0x0100000011D90000,"1.3.0","Diamant Étincelant","sinnoh",8,"bdsp",0x4C90330),
            new(0x010018E011D92000,"1.3.0","Perle Scintillante","sinnoh",8,"bdsp",0x4EA7408)
        };
        foreach(var (version,offset) in new (string,ulong)[]{("1.0.1",0x42FD550),("1.1.0",0x43A77B8),("1.2.0",0x44CCA58),("1.3.0",0x44E2F38),("1.3.2",0x44E4FD8),("2.0.1",0x46447D8),("3.0.0",0x4763C98),("3.0.1",0x4763C98),("4.0.0",0x4763C98)}) {
            result.Add(new(0x0100A3D008C5C000,version,"Écarlate","paldea",9,"sv",offset));
            result.Add(new(0x01008F6008C5E000,version,"Violet","paldea",9,"sv",offset));
        }
        return result.ToArray();
    }
    public static SwitchProfile? Find(ulong title,string version)=>Profiles.SingleOrDefault(p=>p.TitleId==title && p.Version==version);
    public static PartyFrame Read(SwitchProfile p,ulong main,ulong heap,Func<ulong,int,byte[]> read) {
        ulong Ptr(ulong a){ulong v=BinaryPrimitives.ReadUInt64LittleEndian(read(a,8));if(v<0x10000 || v>=0x8000000000 || (v&7)!=0)throw new InvalidDataException("Pointeur du jeu indisponible.");return v;}
        (ulong[] Addresses,byte[][] Slots) Capture() {
            int size=p.Layout=="pla"?376:344;var addresses=new List<ulong>();var slots=new List<byte[]>();
            ulong party=0;int count=6;
            switch(p.Layout){
                case "swsh":party=checked(heap+p.Offset);count=read(party+6*344,1)[0];break;
                case "pla":party=Ptr(Ptr(Ptr(main+p.Offset)+0xD0)+0x58);count=read(party+0x88,1)[0];break;
                case "bdsp":party=Ptr(Ptr(Ptr(Ptr(Ptr(Ptr(Ptr(main+p.Offset)+0x18)+0xC0)+0x28)+0xB8))+0x808);count=checked((int)BinaryPrimitives.ReadUInt32LittleEndian(read(party+0x18,4)));break;
                case "sv":party=Ptr(Ptr(main+p.Offset)+8);break;
                default:throw new InvalidDataException("Version du jeu non prise en charge.");
            }
            if(count is <1 or >6)throw new InvalidDataException("En attente de l’équipe.");
            // SV separates the 0x148-byte encrypted body from its 16-byte party
            // stats. Reading 344 contiguous bytes includes unrelated memory.

            byte[]? packed=p.Layout=="swsh"?read(party,count*size):null;
            bool empty=false;
            for(int i=0;i<count;i++){
                ulong address,statsAddress=0;
                if(p.Layout=="swsh")address=party+(ulong)(i*size);
                else if(p.Layout=="pla")address=Ptr(Ptr(Ptr(party+0x58+(ulong)i*8)+0x98)+0x10);
                else if(p.Layout=="bdsp")address=Ptr(Ptr(Ptr(Ptr(party+0x10)+0x20+(ulong)i*8)+0x20)+0x18)+0x20;
                else {
                    ulong slot=BinaryPrimitives.ReadUInt64LittleEndian(read(party+0x30+(ulong)i*8,8));
                    if(slot==0){empty=true;continue;}
                    if(empty)throw new InvalidDataException("Équipe en cours de modification.");
                    if(slot<0x10000 || slot>=0x8000000000 || (slot&7)!=0)throw new InvalidDataException();
                    address=Ptr(slot+0x30);statsAddress=Ptr(slot+0x50);
                }
                if(addresses.Contains(address))throw new InvalidDataException("Emplacements en cours de mise à jour.");
                addresses.Add(address);
                if(p.Layout=="sv") {
                    var record=new byte[344];
                    read(address,328).CopyTo(record,0);read(statsAddress,16).CopyTo(record,328);
                    addresses.Add(statsAddress);slots.Add(record);
                }else slots.Add(packed!=null?packed.AsSpan(i*size,size).ToArray():read(address,size));
            }
            return (addresses.ToArray(),slots.ToArray());
        }
        PartyMember[] Decode(byte[][] records) {
            var team=new List<PartyMember>();bool empty=false;
            foreach(var record in records) {
                if(p.Layout=="sv" && record.Take(328).All(b=>b==0)){empty=true;continue;}
                var member=ModernPartyDecoder.DecodeSwitch(record,p.Generation,p.Layout=="pla");
                if(member==null && p.Layout=="sv"){empty=true;continue;}
                if(member==null||empty)throw new InvalidDataException("Équipe en cours de modification.");
                team.Add(member);
            }
            return team.ToArray();
        }
        var first=Capture();var team=Decode(first.Slots);
        if(team.Length==0)throw new InvalidDataException("En attente du premier Pokémon.");
        var second=Capture();
        var latest=Decode(second.Slots);
        // HP, experience, item and animation fields can change while the party remains
        // valid. Compare identities and slot pointers; never demand identical raw bytes.
        if(!first.Addresses.SequenceEqual(second.Addresses)||!PartyIdentity.SameOrder(team,latest))
            throw new InvalidDataException("Équipe en cours de mise à jour.");
        PartyIdentity.ConfirmZeros(team,latest);
        return new(p.Game,latest);
    }
}
