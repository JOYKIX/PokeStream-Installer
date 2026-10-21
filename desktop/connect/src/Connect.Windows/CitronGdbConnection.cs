using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
namespace PokeStream.Connect;

// Only two monitor queries and Continue are used. No memory writes, registers,
// breakpoints or recurring interrupts. Steady-state reads use ProcessMemory.
internal sealed class CitronGdbConnection : IDisposable {
    private readonly TcpClient client=new();
    private NetworkStream stream=null!;
    private readonly CancellationToken cancellation;
    private long deadline;
    private bool resumed;
    internal record Location(ulong TitleId,ulong ProcessId,ulong Main,ulong Heap,ulong Native,ulong Size);

    public CitronGdbConnection(EmulatorProcess target,CancellationToken ct) {
        cancellation=ct;
        try {
            int port=FindPort(target);
            using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(1500);
            client.NoDelay=true;
            client.ConnectAsync(IPAddress.Loopback,port,timeout.Token).GetAwaiter().GetResult();
            stream=client.GetStream();stream.ReadTimeout=400;stream.WriteTimeout=700;
            // Citron pauses once when accepting a debugger. Resume immediately,
            // before metadata queries, and never interrupt the running game.
            Send("c");resumed=true;
            if(!Query("qSupported").Contains("qXfer:",StringComparison.Ordinal))
                throw new IOException("Interface GDB Citron non reconnue.");
        } catch {
            if(stream!=null && !resumed)try{Send("c");}catch(IOException){}
            Dispose();throw;
        }
    }
    public Location Locate() {
        string info=Monitor("get info"),fast=Monitor("get fastmem");
        ulong Hex(string source,string pattern) {
            var m=Regex.Match(source,pattern,RegexOptions.Multiline|RegexOptions.CultureInvariant);
            if(!m.Success || !ulong.TryParse(m.Groups[1].Value,NumberStyles.HexNumber,CultureInfo.InvariantCulture,out ulong value))
                throw new InvalidDataException("Informations mémoire Citron indisponibles.");
            return value;
        }
        if(fast.Contains("not enabled",StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Active Fastmem dans Citron, puis relance le jeu.");
        ulong title=Hex(info,@"^\s*Program Id:\s*0x([0-9a-fA-F]+)"),
            process=Hex(info,@"^\s*Process:\s*0x([0-9a-fA-F]+)"),
            main=Hex(info,@"^\s*0x([0-9a-fA-F]+)\s*-\s*0x[0-9a-fA-F]+\s+main\s*$"),
            heap=Hex(info,@"^\s*Heap:\s*0x([0-9a-fA-F]+)"),
            native=Hex(fast,@"^\s*Host address:\s*0x([0-9a-fA-F]+)"),
            end=Hex(fast,@"^\s*Host address:\s*0x[0-9a-fA-F]+\s*-\s*0x([0-9a-fA-F]+)");
        if(native<0x10000 || end<=native || end>=0x7FFFFFFF0000 || end-native>=0x8000000000 ||
            main<0x10000 || heap<0x10000 || main>end-native || heap>end-native)
            throw new InvalidDataException("Informations mémoire Citron indisponibles.");
        return new(title,process,main,heap,native,end-native+1);
    }
    private string Monitor(string command) {
        string hex=Query("qRcmd,"+Convert.ToHexString(Encoding.ASCII.GetBytes(command)));
        if(hex.Length>32768 || (hex.Length&1)!=0)throw new IOException("Réponse GDB invalide.");
        try{return Encoding.UTF8.GetString(Convert.FromHexString(hex));}
        catch(FormatException){throw new IOException("Réponse GDB invalide.");}
    }
    private void Send(string command) {
        var body=Encoding.ASCII.GetBytes(command);
        int sum=body.Sum(b=>(int)b)&255;
        stream.Write(Encoding.ASCII.GetBytes("$"+command+"#"+sum.ToString("x2")));
    }
    private int NextByte() {
        while(true) {
            cancellation.ThrowIfCancellationRequested();
            if(Environment.TickCount64>=deadline)throw new IOException("Citron ne répond pas.");
            try{int value=stream.ReadByte();if(value<0)throw new EndOfStreamException();return value;}
            catch(IOException e)when(e.InnerException is SocketException s && s.SocketErrorCode==SocketError.TimedOut){}
        }
    }
    private string Query(string command) {
        cancellation.ThrowIfCancellationRequested();deadline=Environment.TickCount64+1800;
        Send(command);int ignored=0;
        while(true) {
            int start=NextByte();
            if(start=='-')throw new IOException("Commande GDB refusée.");
            if(start!='$'){if(++ignored>128)throw new IOException("Réponse GDB invalide.");continue;}
            var wire=new List<byte>();int sum=0,value;
            while((value=NextByte())!='#') {
                if(wire.Count>=32768)throw new IOException("Réponse GDB trop longue.");
                wire.Add((byte)value);sum=(sum+value)&255;
            }
            string checksum=new([(char)NextByte(),(char)NextByte()]);
            if(!byte.TryParse(checksum,NumberStyles.HexNumber,CultureInfo.InvariantCulture,out var expected) || expected!=sum)
                throw new IOException("Somme de contrôle GDB invalide.");
            stream.WriteByte((byte)'+');
            var decoded=new List<byte>();
            for(int i=0;i<wire.Count;i++){
                byte b=wire[i];
                if(b=='}') {if(++i>=wire.Count)throw new IOException();decoded.Add((byte)(wire[i]^0x20));}
                else if(b=='*') {
                    if(++i>=wire.Count || decoded.Count==0 || wire[i]<29)throw new IOException();
                    int repeat=wire[i]-29;byte previous=decoded[^1];
                    for(int n=0;n<repeat;n++)decoded.Add(previous);
                } else decoded.Add(b);
                if(decoded.Count>32768)throw new IOException();
            }
            string reply=Encoding.ASCII.GetString(decoded.ToArray());
            // We never set breakpoints. A stop notification must not be consumed
            // as metadata, and Connect must not resume someone else's debug stop.
            if(reply.StartsWith('T') || reply.StartsWith('S') || reply.StartsWith('W') || reply.StartsWith('X'))
                throw new IOException("Lecture Citron interrompue.");
            return reply;
        }
    }
    private static int FindPort(EmulatorProcess target) {
        if(!ProcessMemory.IsRunning(target))throw new IOException("Émulateur fermé.");
        var ports=new HashSet<int>{6543};
        using var process=Process.GetProcessById(target.Id);
        string? executable=Path.GetDirectoryName(process.MainModule?.FileName);
        string roaming=Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        foreach(string config in new[]{
            Path.Combine(executable??"","user","config","qt-config.ini"),
            Path.Combine(roaming,"Citron","config","qt-config.ini"),
            Path.Combine(roaming,"citron-neo","config","qt-config.ini")}) {
            try {
                if(!Path.IsPathFullyQualified(config) || !File.Exists(config) || new FileInfo(config).Length>1024*1024)continue;
                var match=Regex.Match(File.ReadAllText(config),@"(?m)^\s*gdbstub_port\s*=\s*(\d+)\s*$");
                if(match.Success && int.TryParse(match.Groups[1].Value,out int port) && port is >=1024 and <=65535)ports.Add(port);
            }catch(Exception e)when(e is IOException or UnauthorizedAccessException){}
        }
        int size=0;
        GetExtendedTcpTable(IntPtr.Zero,ref size,false,2,5,0);
        if(size is <4 or >4*1024*1024)throw new IOException("Serveur GDB Citron indisponible.");
        IntPtr buffer=Marshal.AllocHGlobal(size);
        try {
            if(GetExtendedTcpTable(buffer,ref size,false,2,5,0)!=0)throw new IOException("Serveur GDB Citron indisponible.");
            int count=Marshal.ReadInt32(buffer);
            if(count<0 || count>(size-4)/24)throw new IOException();
            var rows=new List<(int State,int Port,uint Address)>();
            for(int i=0;i<count;i++) {
                IntPtr row=IntPtr.Add(buffer,4+i*24);
                if(Marshal.ReadInt32(row,20)!=target.Id)continue;
                uint address=unchecked((uint)Marshal.ReadInt32(row,4));
                uint raw=unchecked((uint)Marshal.ReadInt32(row,8));
                int port=(int)(((raw&255)<<8)|((raw>>8)&255));
                if(ports.Contains(port))rows.Add((Marshal.ReadInt32(row),port,address));
            }
            var listeners=rows.Where(r=>r.State==2 && (r.Address==0 || r.Address==0x0100007f)).Select(r=>r.Port).Distinct().ToArray();
            if(listeners.Length!=1)throw new IOException("Active le serveur GDB dans Citron, puis relance le jeu.");
            if(rows.Any(r=>r.Port==listeners[0] && r.State==5))throw new IOException("Le débogueur Citron est déjà utilisé.");
            return listeners[0];
        }finally{Marshal.FreeHGlobal(buffer);}
    }
    public void Dispose()=>client.Dispose();
    [DllImport("iphlpapi.dll",SetLastError=true)]
    private static extern uint GetExtendedTcpTable(IntPtr table,ref int size,bool order,int family,int tableClass,uint reserved);
}
