using System.ComponentModel;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
namespace PokeStream.Connect;

internal static class GdbPort {
    private record Row(int Pid,int State,int Port,IPAddress Address);
    public static IPEndPoint Resolve(EmulatorProcess target,int port) {
        if(port is <1 or >65535)throw new IOException("Renseigne le port GDB dans Réglages.");
        using var process=Process.GetProcessById(target.Id);
        if(process.HasExited || process.ProcessName!=target.Name || process.StartTime.ToUniversalTime().Ticks!=target.Started)
            throw new IOException("Émulateur fermé.");
        var rows=Rows(2).Concat(Rows(23)).Where(r=>r.Port==port).ToArray();
        var listeners=rows.Where(r=>r.State==2 && (IPAddress.IsLoopback(r.Address) || r.Address.Equals(IPAddress.Any) || r.Address.Equals(IPAddress.IPv6Any))).ToArray();
        if(listeners.Length==0)throw new IOException("Port GDB fermé. Vérifie le port et active le serveur GDB dans l’émulateur.");
        if(listeners.Any(r=>r.Pid!=target.Id))throw new IOException("Ce port GDB appartient à une autre application.");
        if(rows.Any(r=>r.Pid==target.Id && r.State==5))throw new IOException("Ce serveur GDB est déjà utilisé par un autre client.");
        var family=listeners.OrderBy(r=>r.Address.AddressFamily==AddressFamily.InterNetwork?0:1).First().Address.AddressFamily;
        return new(family==AddressFamily.InterNetwork?IPAddress.Loopback:IPAddress.IPv6Loopback,port);
    }
    private static Row[] Rows(int family) {
        int size=0;
        uint code=GetExtendedTcpTable(IntPtr.Zero,ref size,false,family,5,0);
        if(family==23 && code is 50 or 232)return [];
        if(code!=0 && code!=122)throw new Win32Exception((int)code);
        for(int attempt=0;attempt<2;attempt++) {
            if(size is <4 or >4*1024*1024)throw new IOException("Liste des ports GDB indisponible.");
            int allocated=size;IntPtr buffer=Marshal.AllocHGlobal(allocated);
            try {
                code=GetExtendedTcpTable(buffer,ref size,false,family,5,0);
                if(code==122)continue;
                if(code!=0)throw new Win32Exception((int)code);
                int stride=family==2?24:56,count=Marshal.ReadInt32(buffer);
                if(count<0 || count>(allocated-4)/stride)throw new IOException("Liste des ports GDB indisponible.");
                var result=new Row[count];
                for(int i=0;i<count;i++) {
                    IntPtr row=IntPtr.Add(buffer,4+i*stride);IPAddress address;int state,pid,offset;
                    if(family==2) {
                        address=new IPAddress(unchecked((uint)Marshal.ReadInt32(row,4)));
                        state=Marshal.ReadInt32(row);pid=Marshal.ReadInt32(row,20);offset=8;
                    }else {
                        var bytes=new byte[16];Marshal.Copy(row,bytes,0,16);
                        address=new IPAddress(bytes,unchecked((uint)Marshal.ReadInt32(row,16)));
                        state=Marshal.ReadInt32(row,48);pid=Marshal.ReadInt32(row,52);offset=20;
                    }
                    uint raw=unchecked((uint)Marshal.ReadInt32(row,offset));
                    result[i]=new(pid,state,(int)(((raw&255)<<8)|((raw>>8)&255)),address);
                }
                return result;
            }finally{Marshal.FreeHGlobal(buffer);}
        }
        throw new IOException("Liste des ports GDB indisponible.");
    }
    [DllImport("iphlpapi.dll",SetLastError=true)]
    private static extern uint GetExtendedTcpTable(IntPtr table,ref int size,bool order,int family,int tableClass,uint reserved);
}
