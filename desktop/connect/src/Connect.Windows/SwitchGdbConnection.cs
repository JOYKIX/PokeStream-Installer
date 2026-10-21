using System.Globalization;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
namespace PokeStream.Connect;

internal sealed class GdbMemoryUnavailable():IOException("Mémoire du jeu temporairement indisponible.");
internal sealed class GdbStopped():IOException("Jeu arrêté par le débogueur. Relance la connexion depuis Réglages.");
internal sealed class GdbBudgetExpired():IOException("Lecture GDB retardée.");

// Ryujinx and Citron implement qRcmd "get info" and standard "m" reads
// while running. No interrupt, write, register change or breakpoint is sent.
internal sealed class SwitchGdbConnection : IDisposable {
    private readonly TcpClient client;
    private readonly NetworkStream stream;
    private readonly CancellationToken cancellation;
    private bool noAck,initializing=true;
    private long deadline,frameDeadline=long.MaxValue;
    private int packetSize=4096;
    internal record Module(ulong Address,ulong End,string Name);
    internal record Info(ulong TitleId,ulong Heap,ulong HeapEnd,Module[] Modules,string Key);

    public SwitchGdbConnection(EmulatorProcess target,int port,CancellationToken ct) {
        cancellation=ct;
        var endpoint=GdbPort.Resolve(target,port);
        client=new(endpoint.AddressFamily){NoDelay=true};
        try {
            using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(2000);
            client.ConnectAsync(endpoint.Address,endpoint.Port,timeout.Token).GetAwaiter().GetResult();
            stream=client.GetStream();stream.ReadTimeout=300;stream.WriteTimeout=1000;
            // Consume each command's acknowledgement separately. Citron pauses
            // on attach; resume once before reading the game, not at every poll.
            string supported=Query("qSupported");
            var match=Regex.Match(supported,@"(?:^|;)PacketSize=([0-9a-fA-F]+)(?:;|$)");
            if(!match.Success)throw new IOException("Le serveur ne répond pas au protocole GDB attendu.");
            packetSize=Math.Clamp(int.Parse(match.Groups[1].Value,NumberStyles.HexNumber,CultureInfo.InvariantCulture),512,65536);
            if(supported.Split(';').Contains("QStartNoAckMode+") && Query("QStartNoAckMode")=="OK")noAck=true;
            Send("c");deadline=Environment.TickCount64+2000;
            if(!noAck) {
                while(true) {
                    int value=NextByte();
                    if(value=='+')break;
                    if(value=='-')throw new IOException("Reprise du jeu refusée par GDB.");
                    if(value=='$'){string reply=Packet();if(IsStop(reply))continue;throw new IOException("Reprise du jeu refusée par GDB.");}
                }
            }
            initializing=false;
        }catch {
            // A failed handshake must not leave Citron frozen after its
            // mandatory initial debugger pause.
            if(target.Label=="Citron" && stream!=null)try{Send("c");}catch(IOException){}
            client.Dispose();throw;
        }
    }
    public void BeginFrame()=>frameDeadline=Environment.TickCount64+6000;
    public void EndFrame()=>frameDeadline=long.MaxValue;
    public Info GetInfo() {
        string info=Monitor("get info");
        if(info.Contains("Unknown command",StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(info))
            throw new InvalidDataException("Cette version du serveur GDB ne fournit pas les informations du jeu.");
        ulong Hex(string pattern) {
            var match=Regex.Match(info,pattern,RegexOptions.Multiline|RegexOptions.CultureInvariant|RegexOptions.IgnoreCase);
            if(!match.Success || !ulong.TryParse(match.Groups[1].Value,NumberStyles.HexNumber,CultureInfo.InvariantCulture,out ulong value))
                throw new InvalidDataException("Informations du jeu GDB indisponibles. Lance une partie.");
            return value;
        }
        ulong title=Hex(@"^\s*Program\s+Id:\s*0x([0-9a-f]+)"),heap=Hex(@"^\s*Heap:\s*0x([0-9a-f]+)"),
            end=Hex(@"^\s*Heap:\s*0x[0-9a-f]+\s*-\s*0x([0-9a-f]+)");
        var modules=new List<Module>();
        int start=info.IndexOf("Modules:",StringComparison.OrdinalIgnoreCase);
        if(start>=0)foreach(Match m in Regex.Matches(info[start..],@"(?m)^\s*0x([0-9a-fA-F]+)\s*-\s*0x([0-9a-fA-F]+)\s+([^\r\n]+)")) {
            ulong a=ulong.Parse(m.Groups[1].Value,NumberStyles.HexNumber,CultureInfo.InvariantCulture),
                b=ulong.Parse(m.Groups[2].Value,NumberStyles.HexNumber,CultureInfo.InvariantCulture);
            if(a>=0x10000 && a<=b && b<0x8000000000)modules.Add(new(a,b,m.Groups[3].Value.Trim()));
        }
        if(heap<0x10000 || heap>end || end>=0x8000000000 || modules.Count is <1 or >32 || modules.Select(m=>m.Address).Distinct().Count()!=modules.Count)
            throw new InvalidDataException("Informations du jeu GDB indisponibles. Lance une partie.");
        // Citron's process ID changes after restarting a game; Ryujinx omits it.
        string process=Regex.Match(info,@"(?m)^\s*Process:\s*(0x[0-9a-fA-F]+)").Groups[1].Value;
        string key=title.ToString("x")+":"+heap.ToString("x")+":"+end.ToString("x")+":"+process+":"+string.Join(";",modules.Select(m=>m.Address.ToString("x")+":"+m.End.ToString("x")+":"+m.Name));
        return new(title,heap,end,modules.ToArray(),key);
    }
    public byte[] Read(ulong address,int count) {
        if(address<0x10000 || address>=0x8000000000 || count is <1 or >4096 || (ulong)count>0x8000000000-address)throw new GdbMemoryUnavailable();
        var result=new byte[count];
        int maximum=Math.Min(4096,(packetSize-16)/2);
        for(int offset=0;offset<count;offset+=maximum) {
            int length=Math.Min(maximum,count-offset);
            string reply=Query("m"+(address+(ulong)offset).ToString("x")+","+length.ToString("x"));
            if(IsError(reply))throw new GdbMemoryUnavailable();
            if(reply.Length!=length*2)throw new IOException("Réponse mémoire GDB incomplète.");
            try{Convert.FromHexString(reply).CopyTo(result,offset);}
            catch(FormatException){throw new IOException("Réponse mémoire GDB invalide.");}
        }
        return result;
    }
    private string Monitor(string command) {
        string result=Query("qRcmd,"+Convert.ToHexString(Encoding.ASCII.GetBytes(command)),console:true);
        if(IsError(result))throw new InvalidDataException("Cette version du serveur GDB ne fournit pas les informations du jeu.");
        try{return Encoding.UTF8.GetString(Convert.FromHexString(result));}
        catch(FormatException){throw new IOException("Réponse GDB invalide.");}
    }
    private static bool IsError(string reply)=>Regex.IsMatch(reply,@"^E[0-9a-fA-F]{2}$");
    private static bool IsStop(string reply)=>Regex.IsMatch(reply,@"^[TSWX][0-9a-fA-F]{2}");
    private void Send(string command) {
        int sum=Encoding.ASCII.GetBytes(command).Sum(b=>(int)b)&255;
        stream.Write(Encoding.ASCII.GetBytes("$"+command+"#"+sum.ToString("x2")));
    }
    private int NextByte() {
        while(true) {
            cancellation.ThrowIfCancellationRequested();
            long now=Environment.TickCount64;
            // Once a request is in flight, timeouts invalidate the connection:
            // a late reply must never be consumed by a later memory request.
            if(now>=deadline)throw new IOException("Le serveur GDB ne répond pas. Vérifie le port et le jeu ouvert.");
            try{int value=stream.ReadByte();if(value<0)throw new EndOfStreamException("Connexion GDB fermée par l’émulateur.");return value;}
            catch(IOException e)when(e.InnerException is SocketException s && s.SocketErrorCode==SocketError.TimedOut){}
        }
    }
    private string Packet() {
        var wire=new List<byte>();int sum=0,value;
        while((value=NextByte())!='#') {
            if(wire.Count>=65536)throw new IOException("Réponse GDB trop longue.");
            wire.Add((byte)value);sum=(sum+value)&255;
        }
        string checksum=new([(char)NextByte(),(char)NextByte()]);
        if(!byte.TryParse(checksum,NumberStyles.HexNumber,CultureInfo.InvariantCulture,out var expected) || expected!=sum)
            throw new IOException("Somme de contrôle GDB invalide.");
        if(!noAck)stream.WriteByte((byte)'+');
        var decoded=new List<byte>();
        for(int i=0;i<wire.Count;i++){
            byte b=wire[i];
            if(b=='}') {if(++i>=wire.Count)throw new IOException("Réponse GDB invalide.");decoded.Add((byte)(wire[i]^0x20));}
            else if(b=='*') {
                if(++i>=wire.Count || decoded.Count==0 || wire[i]<29)throw new IOException("Réponse GDB invalide.");
                byte previous=decoded[^1];for(int n=0;n<wire[i]-29;n++)decoded.Add(previous);
            }else decoded.Add(b);
            if(decoded.Count>65536)throw new IOException("Réponse GDB trop longue.");
        }
        return Encoding.ASCII.GetString(decoded.ToArray());
    }
    private string Query(string command,bool console=false) {
        cancellation.ThrowIfCancellationRequested();
        if(Environment.TickCount64>=frameDeadline)throw new GdbBudgetExpired();
        deadline=Environment.TickCount64+2500;
        Send(command);int ignored=0;var output=new StringBuilder();
        while(true) {
            int start=NextByte();
            if(start=='-')throw new IOException("Commande GDB refusée.");
            if(start!='$'){if(++ignored>128)throw new IOException("Réponse GDB invalide.");continue;}
            string reply=Packet();
            if(IsStop(reply)) {
                if(initializing)continue;
                throw new GdbStopped();
            }
            if(console && reply.StartsWith('O') && reply!="OK") {
                output.Append(reply.AsSpan(1));
                if(output.Length>65536)throw new IOException("Réponse GDB trop longue.");
                continue;
            }
            if(console && reply=="OK")return output.ToString();
            if(console && output.Length>0)throw new IOException("Réponse GDB invalide.");
            return reply;
        }
    }
    public void Dispose()=>client.Dispose();
}
