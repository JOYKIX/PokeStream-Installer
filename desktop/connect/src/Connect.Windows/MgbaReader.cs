using System.Security.Cryptography;
using System.Text;
namespace PokeStream.Connect;
public sealed class MgbaReader(EmulatorProcess target):IDisposable {
    private readonly ProcessMemory memory=new(target);
    private DateTime nextSearch;private ulong rom;private byte[]? header;private Profile? profile;private ulong? ram;
    private record Profile(string Name,string Game,int Generation,uint Count,uint Party);
    private static readonly Dictionary<string,Profile> Gb=new(StringComparer.OrdinalIgnoreCase){
        ["ea9bcae617fdf159b045185467ae58b2e4a48b9a"]=new("Rouge (EN)","kanto",1,0xD163,0),["d7037c83e1ae5b39bde3c30787637ba1d4c48ce2"]=new("Bleu (EN)","kanto",1,0xD163,0),["cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1"]=new("Jaune (EN)","kanto",1,0xD162,0),
        ["d8b8a3600a465308c9953dfa04f0081c05bdcb94"]=new("Or (EN)","johto",2,0xDA22,0),["49b163f7e57702bc939d642a18f591de55d92dae"]=new("Argent (EN)","johto",2,0xDA22,0),["f4cd194bdee0d04ca4eac29e09b8e4e9d818c133"]=new("Cristal (EN)","johto",2,0xDCD7,0),["f2f52230b536214ef7c9924f483392993e226cfb"]=new("Cristal (EN)","johto",2,0xDCD7,0),["a0fc810f1d4e124434f7be2c989ab5b5892ddf36"]=new("Cristal (EN)","johto",2,0xDCD7,0)
    };
    private static Profile? Gba(byte[] bytes){
        string code=Encoding.ASCII.GetString(bytes,0xAC,4);int sum=0x19;for(int i=0xA0;i<=0xBD;i++)sum+=bytes[i];if((sum&255)!=0)return null;
        // Unverified revisions/languages remain available through the save reader.
        return code switch {
            "BPRE" or "BPGE" or "BPRF" or "BPGF" when bytes[0xBC]<=1=>new("Rouge Feu · Vert Feuille","kanto",3,0x02024029,0x02024284),
            "BPEE" when bytes[0xBC]==0=>new("Émeraude (EN)","hoenn",3,0x020244E9,0x020244EC),
            "AXVE" or "AXPE" when bytes[0xBC]<=2=>new("Rubis · Saphir (EN)","hoenn",3,0x03004350,0x03004360),_=>null};
    }
    public (string Name,PartyFrame Frame)? Read(CancellationToken ct) {
        ct.ThrowIfCancellationRequested();
        if(profile!=null)try {
            if(!memory.Read(rom,512).AsSpan().SequenceEqual(header)) {profile=null;ram=null;}
            else if(ram is {} start)return (profile.Name,ReadParty(start,profile));
        }catch(InvalidDataException){return null;} // A partial party is not a lost RAM mapping.
        catch(IOException){ram=null;}
        if(DateTime.UtcNow<nextSearch)return null;nextSearch=DateTime.UtcNow.AddSeconds(3);
        var regions=memory.Regions().ToArray();
        if(profile==null){
            var found=new List<(ulong Address,byte[] Header,Profile Profile)>();
            foreach(var region in regions.Where(r=>r.Size>=0x80000&&r.Size<=0x4000000))try{
                ct.ThrowIfCancellationRequested();var bytes=memory.Read(region.Address,512);var p=Gba(bytes);
                if(p==null&&Encoding.ASCII.GetString(bytes,0x134,7)=="POKEMON"&&bytes[0x148]<=6){
                    int length=0x8000<<bytes[0x148];if((ulong)length>region.Size)continue;
                    using var hash=IncrementalHash.CreateHash(HashAlgorithmName.SHA1);var buffer=new byte[65536];
                    for(int at=0;at<length;at+=buffer.Length){ct.ThrowIfCancellationRequested();int n=Math.Min(buffer.Length,length-at);if(memory.ReadInto(region.Address+(ulong)at,buffer,n)!=n)throw new IOException();hash.AppendData(buffer,0,n);}
                    p=Gb.GetValueOrDefault(Convert.ToHexString(hash.GetHashAndReset()));
                }
                if(p!=null)found.Add((region.Address,bytes,p));
            }catch(IOException){}
            if(found.Count!=1)return null;(rom,header,profile)=found[0];
        }
        var candidates=new List<(ulong Address,PartyFrame Frame)>();
        foreach(var region in regions.Where(r=>r.Size==(profile.Generation==3?0x48000UL:0x8000UL)))try{candidates.Add((region.Address,ReadParty(region.Address,profile)));}catch(Exception e)when(e is IOException or InvalidDataException){}
        if(candidates.Count!=1)return null;ram=candidates[0].Address;return (profile.Name,candidates[0].Frame);
    }
    private PartyFrame ReadParty(ulong start,Profile p){
        ulong Host(uint guest)=>start+(p.Generation<3?guest-0xC000:guest>=0x03000000?0x40000+guest-0x03000000:guest-0x02000000);
        if(p.Generation<3){int length=8+6*((p.Generation==1?44:48)+22);var bytes=memory.Read(Host(p.Count),length);var frame=ClassicPartyDecoder.DecodeGb(bytes,p.Generation);if(!bytes.AsSpan().SequenceEqual(memory.Read(Host(p.Count),length)))throw new InvalidDataException();return frame with {Badges=BadgeMemoryReader.Read(BadgeMemoryReader.Gb(p.Count),(a,n)=>memory.Read(Host(a),n))};}
        int count=memory.Read(Host(p.Count),1)[0];if(count is <1 or >6)throw new InvalidDataException();var data=memory.Read(Host(p.Party),count*100);var team=new PartyMember[count];for(int i=0;i<count;i++)team[i]=ClassicPartyDecoder.DecodeGba(data.AsSpan(i*100,100).ToArray(),DeoxysForm());
        int DeoxysForm()=>Encoding.ASCII.GetString(header!,0xAC,4) switch {"BPRE" or "BPRF"=>1,"BPGE" or "BPGF"=>2,"BPEE"=>3,_=>0};
        var second=memory.Read(Host(p.Party),data.Length);
        var latest=Enumerable.Range(0,count).Select(i=>ClassicPartyDecoder.DecodeGba(second.AsSpan(i*100,100).ToArray(),DeoxysForm())).ToArray();
        if(memory.Read(Host(p.Count),1)[0]!=count||!PartyIdentity.SameOrder(team,latest))throw new InvalidDataException();
        PartyIdentity.ConfirmZeros(team,latest);return new(p.Game,latest,BadgeMemoryReader.Read(BadgeMemoryReader.Gba(Encoding.ASCII.GetString(header!,0xAC,4),header![0xBC]),(a,n)=>memory.Read(Host(a),n)));
    }
    public void Dispose()=>memory.Dispose();
}
