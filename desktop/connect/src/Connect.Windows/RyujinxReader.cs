using System.Buffers.Binary;
using System.ComponentModel;
using System.Diagnostics;
using Microsoft.Diagnostics.Runtime;
namespace PokeStream.Connect;

// ClrMD takes a temporary Windows process snapshot to locate native guest memory.
// Subsequent team reads use ReadProcessMemory only. No game code is executed or changed.
public sealed class RyujinxReader(EmulatorProcess target,string? locatorExecutable=null):IDisposable {
    private readonly ProcessMemory memory=new(target);
    private readonly CombatReadingPolicy combat=new();
    private Mapping? mapping;
    private DateTime nextLocate,firstMemoryFailure;
    private int locateFailures,memoryFailures;
    private string? lastGameHint;
    public string Status { get; private set; }="Recherche du jeu Switch…";
    public string? GameVersion { get; private set; }
    public record Mapping(SwitchProfile Profile,ulong Heap,ulong Entry,ulong Main,ulong Native,bool Paged,byte[] Signature,bool Software=false);
    public record Inspection(Mapping? Mapping,string Status,string? GameVersion=null);
    public (string Name,PartyFrame Frame)? Read(CancellationToken cancellation) {
        cancellation.ThrowIfCancellationRequested();
        using var process=Process.GetProcessById(target.Id);
        // Ryujinx 1.3.3 can show only its own version in the window title.
        // A title is a hint, never a prerequisite or a source of game version.
        string? hint=GameIdentity.FromName(process.MainWindowTitle);
        if(hint!=null && lastGameHint!=null && hint!=lastGameHint)ResetMapping();
        if(hint!=null)lastGameHint=hint;
        try {
            if(mapping==null){
                if(DateTime.UtcNow<nextLocate)return null;
                Status="Recherche du jeu Switch…";
                var result=LocateInChild(cancellation);
                mapping=result?.Mapping;Status=result?.Status??"Lecture Ryujinx indisponible.";GameVersion=result?.GameVersion;
                if(mapping==null){
                    nextLocate=DateTime.UtcNow.AddSeconds(Math.Min(30,5*Math.Max(1,++locateFailures)));
                    return null;
                }
                locateFailures=0;memoryFailures=0;
            }
            var frame=ReadLocated(mapping);
            memoryFailures=0;firstMemoryFailure=default;Status="Lecture directe";
            return frame;
        }catch(InvalidDataException){
            // Party swaps, loading and partial encrypted records are NOT a detached
            // emulator. Keep the mapping and retry on the next normal polling tick.
            memoryFailures=0;firstMemoryFailure=default;Status="Mise à jour de l’équipe…";return null;
        }catch(Exception e)when(e is IOException or InvalidOperationException or ArgumentException or Win32Exception or NotSupportedException or OverflowException){
            Status="Lecture Ryujinx retardée.";
            if(firstMemoryFailure==default)firstMemoryFailure=DateTime.UtcNow;
            if(++memoryFailures>=3 && DateTime.UtcNow-firstMemoryFailure>=TimeSpan.FromSeconds(15)){ResetMapping();nextLocate=DateTime.UtcNow.AddSeconds(2);}
            return null;
        }
    }
    private void ResetMapping(){combat.Reset();mapping=null;nextLocate=default;firstMemoryFailure=default;memoryFailures=0;locateFailures=0;GameVersion=null;}
    public (string Name,PartyFrame Frame) ReadLocated(Mapping map) {
        if(SwitchPartyReader.Find(map.Profile.TitleId,map.Profile.Version)!=map.Profile)throw new IOException();
        byte[] ReadGuest(ulong address,int count)=>ReadMapped(map.Native,map.Paged,address,count,map.Software);
        if(!ReadGuest(map.Main,32).AsSpan().SequenceEqual(map.Signature))throw new IOException();
        var field=SwitchPartyReader.Read(map.Profile,map.Main,map.Heap,ReadGuest);
        var frame=SwordShieldBattleReader.Read(field,map.Profile,map.Heap,ReadGuest);
        if(frame.InBattle) {
            var current=SwitchPartyReader.Read(map.Profile,map.Main,map.Heap,ReadGuest);
            if(!PartyIdentity.SameOrder(field.Team,current.Team))throw new InvalidDataException("Équipe en cours de réorganisation.");
        }
        return(map.Profile.Name,combat.Apply(frame));
    }
    private Inspection? LocateInChild(CancellationToken cancellation) {
        var start=new ProcessStartInfo(locatorExecutable??Environment.ProcessPath!){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        start.ArgumentList.Add("--locate-ryujinx");start.ArgumentList.Add(target.Id.ToString());start.ArgumentList.Add(target.Started.ToString());
        using var child=Process.Start(start)??throw new IOException();
        var output=child.StandardOutput.ReadToEndAsync(cancellation);var error=child.StandardError.ReadToEndAsync(cancellation);
        using var timeout=CancellationTokenSource.CreateLinkedTokenSource(cancellation);timeout.CancelAfter(TimeSpan.FromSeconds(15));
        try{child.WaitForExitAsync(timeout.Token).GetAwaiter().GetResult();}
        catch(OperationCanceledException){if(!child.HasExited)child.Kill(entireProcessTree:true);if(cancellation.IsCancellationRequested)throw;return null;}
        string json=output.GetAwaiter().GetResult();error.GetAwaiter().GetResult();
        if(child.ExitCode!=0 || json.Length>4096)return null;
        try{return System.Text.Json.JsonSerializer.Deserialize<Inspection>(json);}catch(System.Text.Json.JsonException){return null;}
    }
    // Used only by the short-lived, isolated --locate-ryujinx child process.
    public Inspection Inspect(CancellationToken cancellation) {
        // Revalidate PID/start time before attaching; never inspect another process after PID reuse.
        using(var check=new ProcessMemory(target)){}
        using var snapshot=DataTarget.CreateSnapshotAndAttach(target.Id);
        if(snapshot.ClrVersions.Length!=1)return new(null,"Version de Ryujinx non reconnue.");
        using var runtime=snapshot.ClrVersions[0].CreateRuntime();
        var processes=new List<ClrObject>();var versions=new List<ClrObject>();var infos=new List<ClrObject>();
        int budget=5_000_000;
        foreach(var obj in runtime.Heap.EnumerateObjects()) {
            cancellation.ThrowIfCancellationRequested();if(--budget==0)return new(null,"Lecture Ryujinx indisponible.");
            var name=obj.Type?.Name;
            if(name=="Ryujinx.HLE.HOS.Kernel.Process.KProcess")processes.Add(obj);
            else if(name=="Ryujinx.HLE.Loaders.Processes.ProcessResult")versions.Add(obj);
            else if(name=="Ryujinx.HLE.HOS.Kernel.Process.ProcessTamperInfo")infos.Add(obj);
        }
        ClrObject Field(ClrObject obj,string name)=>obj.ReadObjectField(name);
        ClrObject Prop(ClrObject obj,string name)=>Field(obj,"<"+name+">k__BackingField");
        ulong Value(ClrObject obj,string name)=>obj.ReadField<ulong>(name);
        var found=new List<Mapping>();
        string status="En attente du jeu Switch.";string? detectedVersion=null;
        foreach(var p in processes)try {
            if(p.ReadField<int>("_threadCount")<1)continue;
            ulong id=Value(p,"<TitleId>k__BackingField"),pid=Value(p,"<Pid>k__BackingField");
            var version=versions.Where(v=>Value(v,"ProgramId")==id&&Value(v,"ProcessId")==pid).Select(v=>Field(v,"DisplayVersion").AsString()).Distinct().ToArray();
            if(version.Length!=1 || version[0]==null)continue;
            var profile=SwitchPartyReader.Find(id,version[0]!);
            if(profile==null){
                if(SwitchPartyReader.Profiles.Any(p=>p.TitleId==id)){
                    status="Version du jeu non prise en charge en direct.";detectedVersion=version[0];
                }
                continue;
            }
            detectedVersion=profile.Name+" "+profile.Version;
            status="Mode mémoire Ryujinx non reconnu.";
            var context=Prop(p,"Context");
            var manager=context.TryReadObjectField("_memoryManager",out var mm)?mm:Prop(context,"AddressSpace");
            string type=manager.Type?.Name??"";ulong native;bool paged,software=false;
            if(type=="Ryujinx.Cpu.Jit.MemoryManagerHostTracked"){
                var table=Field(Field(manager,"_nativePageTable"),"_nativePageTable");native=(ulong)table.ReadField<nint>("_pointer");paged=true;
            }else if(type=="Ryujinx.Cpu.Jit.MemoryManagerHostMapped") {
                var block=Prop(Field(manager,"_addressSpace"),"Base");native=(ulong)block.ReadField<nint>("_pointer");paged=false;
            }else if(type=="Ryujinx.Cpu.Jit.MemoryManager") {
                native=(ulong)Field(manager,"_pageTable").ReadField<nint>("_pointer");paged=true;software=true;
            }else continue;
            if(native<0x10000 || native>=0x7FFFFFFF0000)continue;
            ulong heap=Value(Prop(p,"MemoryManager"),"<HeapRegionStart>k__BackingField"),entry=Value(p,"_entrypoint"),main=0;
            var info=infos.Where(i=>Prop(i,"Process").Address==p.Address).ToArray();
            if(info.Length==1)try {
                var codes=Prop(info[0],"CodeAddresses");
                if(codes.Type?.IsArray==true){var bases=codes.AsArray();if(bases.Length>=2)main=bases.ReadValues<ulong>(1,1)![0];}
            }catch(InvalidOperationException){} // MOD0 fallback below for non-array enumerables.
            // rtld precedes main. Its MOD0 BSS end gives the aligned end of that first image.
            if(main==0){
                uint offset=BinaryPrimitives.ReadUInt32LittleEndian(ReadMapped(native,paged,entry+4,4,software));
                if(offset>0x200000)continue;
                var mod=ReadMapped(native,paged,entry+offset,16,software);
                if(BinaryPrimitives.ReadUInt32LittleEndian(mod)!=0x30444F4D)continue;
                uint bssEnd=BinaryPrimitives.ReadUInt32LittleEndian(mod.AsSpan(12));
                if(bssEnd>0x400000)continue;main=(entry+offset+bssEnd+0xFFF)&~0xFFFUL;
            }
            if(main<entry || main-entry>0x800000)continue;
            var signature=ReadMapped(native,paged,main,32,software);
            uint mainMod=BinaryPrimitives.ReadUInt32LittleEndian(signature.AsSpan(4));
            if(mainMod>0x10000000 || BinaryPrimitives.ReadUInt32LittleEndian(ReadMapped(native,paged,main+mainMod,4,software))!=0x30444F4D)continue;
            found.Add(new(profile,heap,entry,main,native,paged,signature,software));
        }catch(Exception e)when(e is IOException or InvalidOperationException or ArgumentException or OverflowException){}
        return found.Count==1?new(found[0],"Lecture directe",found[0].Profile.Name+" "+found[0].Profile.Version)
            :new(null,found.Count>1?"Plusieurs jeux Switch détectés.":status,detectedVersion);
    }
    private byte[] ReadMapped(ulong native,bool paged,ulong address,int count,bool software=false) {
        if(address<0x10000 || address>=0x8000000000 || count is <1 or >4096 || address+(ulong)count>0x8000000000)throw new IOException();
        var result=new byte[count];
        for(int offset=0;offset<count;){ulong guest=address+(ulong)offset;int n=Math.Min(count-offset,4096-(int)(guest&4095));ulong host;
            if(paged){ulong pte=BinaryPrimitives.ReadUInt64LittleEndian(memory.Read(checked(native+(guest>>12)*8),8));if(pte==0)throw new IOException();host=software?checked((pte&0x0000FFFFFFFFFFFF)+(guest&4095)):unchecked(pte+guest);}else host=checked(native+guest);
            if(host<0x10000 || host+(ulong)n>=0x7FFFFFFF0000)throw new IOException();
            memory.Read(host,n).CopyTo(result,offset);offset+=n;
        }
        return result;
    }
    public void Dispose()=>memory.Dispose();
}
