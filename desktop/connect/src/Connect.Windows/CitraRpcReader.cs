using System.Buffers.Binary;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
namespace PokeStream.Connect;

// Shared Citra/Azahar protocol. ReadMemory only, on loopback, after verifying that the selected process owns the RPC port.
public sealed class CitraRpcReader(EmulatorProcess target) : IDisposable {
    private Socket? socket;
    private uint sequence;
    private CitraProfile? activeProfile;
    private readonly CombatReadingPolicy combat=new();
    private DateTime nextAttempt;
    private CancellationToken cancellation;
    private Stopwatch? budget;
    private int timedOutFrames,missingPortReads;
    private long? optionalDeadline;
    private bool optionalReading;
    private sealed class ReadTimeout(string message):IOException(message);
    public (CitraProfile Profile,PartyFrame Frame)? Read()=>Read(null,CancellationToken.None);
    public (CitraProfile Profile,PartyFrame Frame)? Read(string? expectedGame,CancellationToken ct) {
        ct.ThrowIfCancellationRequested();
        if(DateTime.UtcNow<nextAttempt)return null;
        cancellation=ct;budget=Stopwatch.StartNew();optionalDeadline=null;
        try {
            using var process=Process.GetProcessById(target.Id);
            if(process.StartTime.ToUniversalTime().Ticks!=target.Started || process.ProcessName!=target.Name) {
                ResetSocket();return null;
            }
        }catch(Exception e)when(e is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception){
            ResetSocket();return null;
        }
        if(!OwnsPort(target.Id)){if(++missingPortReads>=3)ResetSocket();nextAttempt=DateTime.UtcNow.AddMilliseconds(500);return null;}
        missingPortReads=0;
        if(activeProfile!=null && expectedGame!=null && GameIdentity.FromName(activeProfile.Name)!=expectedGame)
            {activeProfile=null;combat.Reset();}
        try {
            socket??=OpenSocket();
            if(activeProfile is {} active) {
                var frame=StableFrame(active);
                // Keep this layout for the selected game, including menu transitions.
                // Discovery resumes only after a game/process change or a manual rescan.
                if(frame!=null)timedOutFrames=0;
                return frame==null?null:(active,combat.Apply(frame));
            }
            var profiles=CitraPartyReader.Profiles.Where(p=>expectedGame==null || GameIdentity.FromName(p.Name)==expectedGame);
            var found=new List<(CitraProfile,PartyFrame)>();
            foreach(var profile in profiles) {
                if(profile==activeProfile)continue;
                CheckBudget();
                var frame=StableFrame(profile);
                if(frame!=null)found.Add((profile,frame));
            }
            if(found.Count==1){timedOutFrames=0;activeProfile=found[0].Item1;combat.Reset();return (found[0].Item1,combat.Apply(found[0].Item2));}
            nextAttempt=DateTime.UtcNow.AddMilliseconds(activeProfile==null?2000:200);return null;
        }catch(ReadTimeout){
            // A delayed datagram is not a disconnected emulator. Keep the same socket/profile.
            if(++timedOutFrames>=3){ResetSocket();timedOutFrames=0;}
            nextAttempt=DateTime.UtcNow.AddMilliseconds(250);return null;
        }catch(Exception e)when(e is IOException or SocketException){
            // A restarted RPC server needs a fresh UDP endpoint. Preserve the game profile.
            ResetSocket();nextAttempt=DateTime.UtcNow.AddMilliseconds(500);return null;
        }
    }
    private PartyFrame? StableFrame(CitraProfile profile) {
        for(int attempt=0;attempt<2;attempt++) {
            CheckBudget();
            try{return CitraPartyReader.Read(profile,ReadMemory,ReadOptionalMemory);}
            catch(InvalidDataException){if(attempt==0 && cancellation.WaitHandle.WaitOne(40))cancellation.ThrowIfCancellationRequested();}
        }
        return null;
    }
    private static Socket OpenSocket() {
        var next=new Socket(AddressFamily.InterNetwork,SocketType.Dgram,ProtocolType.Udp){
            ReceiveTimeout=100,SendTimeout=200,ReceiveBufferSize=65536
        };
        try{next.Connect(new IPEndPoint(IPAddress.Loopback,45987));return next;}
        catch{next.Dispose();throw;}
    }
    private void CheckBudget(){
        cancellation.ThrowIfCancellationRequested();
        // Leave room for both validated captures, the slot table and UDP retries.
        if(optionalReading && optionalDeadline is long deadline && budget!.ElapsedMilliseconds>=deadline)
            throw new InvalidDataException("Lecture de combat reportée.");
        if(budget!.ElapsedMilliseconds>=6000)throw new ReadTimeout(target.Label+" ne répond pas.");
    }
    private byte[] ReadOptionalMemory(uint address,int count) {
        // Combat enriches a valid team. It must leave time for the final slot-table check.
        optionalDeadline??=Math.Min(5500,budget!.ElapsedMilliseconds+1500);
        optionalReading=true;
        try{return ReadMemory(address,count);}
        finally { optionalReading=false; }
    }
    private byte[] ReadMemory(uint address,int count) {
        if(count is <1 or >4096)throw new InvalidDataException("Lecture RPC invalide.");
        var result=new byte[count];var response=new byte[1040];
        // Four 32-byte requests can be handled in one emulator service cycle. Keep
        // the protocol's old payload limit, validate each response by its own ID.
        for(int start=0;start<count;start+=128) {
            var missing=new List<(int Offset,int Count)>();
            for(int offset=start;offset<Math.Min(count,start+128);offset+=32)
                missing.Add((offset,Math.Min(32,count-offset)));
            for(int attempt=0;attempt<3 && missing.Count>0;attempt++) {
                CheckBudget();var pending=new Dictionary<uint,(int Offset,int Count)>();
                foreach(var chunk in missing) {
                    uint id=++sequence;var request=new byte[24];
                    uint[] fields=[1,id,1,8,address+(uint)chunk.Offset,(uint)chunk.Count];
                    for(int i=0;i<6;i++)BinaryPrimitives.WriteUInt32LittleEndian(request.AsSpan(i*4),fields[i]);
                    socket!.Send(request);pending.Add(id,chunk);
                }
                var waiting=Stopwatch.StartNew();int timeout=attempt==0?350:attempt==1?600:1000;
                while(pending.Count>0 && waiting.ElapsedMilliseconds<timeout) {
                    CheckBudget();int length;
                    try{length=socket!.Receive(response);}
                    catch(SocketException e)when(e.SocketErrorCode is SocketError.TimedOut or SocketError.WouldBlock){continue;}
                    if(length<16 || !pending.TryGetValue(BinaryPrimitives.ReadUInt32LittleEndian(response.AsSpan(4)),out var chunk))continue;
                    if(length!=16+chunk.Count || BinaryPrimitives.ReadUInt32LittleEndian(response)!=1 ||
                        BinaryPrimitives.ReadUInt32LittleEndian(response.AsSpan(8))!=1 ||
                        BinaryPrimitives.ReadUInt32LittleEndian(response.AsSpan(12))!=chunk.Count)continue;
                    response.AsSpan(16,chunk.Count).CopyTo(result.AsSpan(chunk.Offset));
                    pending.Remove(BinaryPrimitives.ReadUInt32LittleEndian(response.AsSpan(4)));
                }
                missing=pending.Values.ToList();
            }
            if(missing.Count>0)throw new ReadTimeout("Lecture RPC retardée.");
        }
        return result;
    }
    internal static bool OwnsPort(int processId) {
        int size=0;GetExtendedUdpTable(IntPtr.Zero,ref size,false,2,1,0);if(size is <4 or >1048576)return false;
        nint data=Marshal.AllocHGlobal(size);
        try{if(GetExtendedUdpTable(data,ref size,false,2,1,0)!=0)return false;int count=Marshal.ReadInt32(data);if(count<0 || 4L+count*12L>size)return false;
            for(int i=0;i<count;i++){int at=4+i*12;int port=(Marshal.ReadByte(data,at+4)<<8)|Marshal.ReadByte(data,at+5);if(port==45987&&Marshal.ReadInt32(data,at+8)==processId)return true;}return false;
        }finally{Marshal.FreeHGlobal(data);}
    }
    private void ResetSocket(){socket?.Dispose();socket=null;}
    public void Dispose()=>ResetSocket();
    [DllImport("iphlpapi.dll")]private static extern uint GetExtendedUdpTable(nint table,ref int size,bool order,int family,int tableClass,uint reserved);
}
