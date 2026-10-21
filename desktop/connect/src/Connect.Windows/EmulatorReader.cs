using System.Diagnostics;
namespace PokeStream.Connect;

public record EmulatorFrame(GameProfile Profile,PartyFrame Frame);

// One reader per selected process. Discovery is incremental and lives off the UI thread.
public sealed class EmulatorReader : IDisposable {
    private readonly ProcessMemory memory;
    public Action<string>? Diagnostic { get; init; }
    private readonly byte[] buffer=new byte[1024*1024];
    private IEnumerator<MemoryRegion>? regions;
    private MemoryRegion? region;
    private ulong offset;
    private DateTime nextSearch;
    private int unavailableReads;
    private readonly CombatReadingPolicy combat=new();
    private (ulong Base,uint Mask,GameProfile Profile)? location;
    public EmulatorReader(EmulatorProcess target)=>memory=new(target);
    private byte[] ReadAt(ulong start,uint mask,uint address,int count) {
        if(address<0x02000000 || address>0x02FFFFFF || count<1 || (address&mask)+(ulong)count>mask+1UL)
            throw new InvalidDataException("Adresse DS invalide.");
        return memory.Read(start+(address&mask),count);
    }
    private EmulatorFrame ReadParty(ulong start,uint mask,GameProfile profile) {
        if(GameProfiles.FromCode(ReadAt(start,mask,GameProfiles.HeaderAddress,4))!=profile) throw new IOException("Le jeu a changé.");
        var frame=DsPartyReader.Read(profile,(a,n)=>ReadAt(start,mask,a,n));
        if(GameProfiles.FromCode(ReadAt(start,mask,GameProfiles.HeaderAddress,4))!=profile) throw new IOException("Le jeu a changé.");
        return new(profile,frame);
    }
    public EmulatorFrame? Read(CancellationToken cancellation=default) {
        cancellation.ThrowIfCancellationRequested();
        if(location is { } found) {
            try {var frame=ReadParty(found.Base,found.Mask,found.Profile);unavailableReads=0;return frame with {Frame=combat.Apply(frame.Frame)};}
            catch(InvalidDataException) {return null;} // transient decryption, no starter, title screen
            catch(IOException) {if(++unavailableReads<3)return null;unavailableReads=0;location=null;combat.Reset();ResetSearch();}
        }
        if(DateTime.UtcNow<nextSearch) return null;
        regions??=memory.Regions().GetEnumerator();
        var watch=Stopwatch.StartNew();int budget=64*1024*1024;
        while(budget>0 && watch.ElapsedMilliseconds<250) {
            cancellation.ThrowIfCancellationRequested();
            if(region==null || offset>=region.Size) {
                if(!regions.MoveNext()) {ResetSearch();nextSearch=DateTime.UtcNow.AddSeconds(3);return null;}
                region=regions.Current;offset=0;
            }
            ulong address=region.Address+offset;
            int count=(int)Math.Min((ulong)buffer.Length,region.Size-offset);
            int read=memory.ReadInto(address,buffer,count);
            offset+=(ulong)count;budget-=count;
            foreach(var candidate in GameProfiles.FindHeaders(buffer,read,address)) {
                Diagnostic?.Invoke("Detected header: "+candidate.Profile.Code);
                ulong header=address+(ulong)candidate.Offset;
                foreach(uint mask in new uint[]{0x3FFFFF,0x7FFFFF,0xFFFFFF}) {
                    uint relative=GameProfiles.HeaderAddress&mask;
                    if(header<relative) continue;
                    ulong start=header-relative;
                    try {
                        var frame=ReadParty(start,mask,candidate.Profile);
                        location=(start,mask,candidate.Profile);ResetSearch();combat.Reset();return frame with {Frame=combat.Apply(frame.Frame)};
                    } catch(Exception e) when(e is IOException or InvalidDataException) { Diagnostic?.Invoke(e.Message); }
                }
            }
        }
        return null;
    }
    private void ResetSearch(){regions?.Dispose();regions=null;region=null;offset=0;nextSearch=default;}
    public void Dispose(){ResetSearch();memory.Dispose();}
}
