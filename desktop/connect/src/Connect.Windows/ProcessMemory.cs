using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
namespace PokeStream.Connect;

public record EmulatorProcess(int Id,string Name,string Label,long Started) {
    public string DisplayLabel => Label+" · "+Id;
}
public record MemoryRegion(ulong Address,ulong Size);

public sealed class ProcessMemory : IDisposable {
    private readonly SafeProcessHandle handle;
    public static string? LabelFor(string name) {
        if(name.Equals("melonDS",StringComparison.OrdinalIgnoreCase) || name.StartsWith("melonDS_",StringComparison.OrdinalIgnoreCase)) return "melonDS";
        if(name.Equals("DeSmuME",StringComparison.OrdinalIgnoreCase) || name.StartsWith("DeSmuME_",StringComparison.OrdinalIgnoreCase) || name.StartsWith("DeSmuME-",StringComparison.OrdinalIgnoreCase)) return "DeSmuME";
        if(name.Equals("citra-qt",StringComparison.OrdinalIgnoreCase)||name.Equals("citra",StringComparison.OrdinalIgnoreCase))return "Citra";
        if(name.Equals("azahar",StringComparison.OrdinalIgnoreCase)||name.Equals("azahar-qt",StringComparison.OrdinalIgnoreCase)||name.Equals("azahar-cli",StringComparison.OrdinalIgnoreCase))return "Azahar";
        if(name.Equals("Ryujinx",StringComparison.OrdinalIgnoreCase))return "Ryujinx";
        if(name.Equals("citron",StringComparison.OrdinalIgnoreCase)||name.Equals("citron-qt",StringComparison.OrdinalIgnoreCase)||name.Equals("citron-cmd",StringComparison.OrdinalIgnoreCase)||name.Equals("citron-neo",StringComparison.OrdinalIgnoreCase))return "Citron";
        if(name.Equals("mGBA",StringComparison.OrdinalIgnoreCase))return "mGBA";
        return null;
    }
    public static bool IsRunning(EmulatorProcess target) {
        try {
            using var process=Process.GetProcessById(target.Id);
            return !process.HasExited && process.ProcessName==target.Name && process.StartTime.ToUniversalTime().Ticks==target.Started;
        } catch(Exception e)when(e is ArgumentException or InvalidOperationException){return false;}
        catch(Win32Exception){return true;} // A transient metadata error must not detach a live session.
    }
    public static EmulatorProcess[] List() {
        var result=new List<EmulatorProcess>();
        foreach(var process in Process.GetProcesses()) using(process) {
            try {
                var label=LabelFor(process.ProcessName);
                if(label!=null) result.Add(new(process.Id,process.ProcessName,label,process.StartTime.ToUniversalTime().Ticks));
            } catch(Exception e) when(e is Win32Exception or InvalidOperationException or NotSupportedException) { }
        }
        return result.OrderBy(p=>p.Label).ThenBy(p=>p.Id).ToArray();
    }
    public ProcessMemory(EmulatorProcess target) {
        using var process=Process.GetProcessById(target.Id);
        if(LabelFor(process.ProcessName)==null || process.ProcessName!=target.Name || process.StartTime.ToUniversalTime().Ticks!=target.Started)
            throw new IOException("Émulateur fermé.");
        // Query and read only. No debug privilege, injection, writes, or suspension.
        handle=OpenProcess(0x0400|0x0010,false,target.Id);
        if(handle.IsInvalid) {int error=Marshal.GetLastWin32Error();handle.Dispose();throw new Win32Exception(error);}
        // Guard against PID reuse between metadata lookup and OpenProcess.
        if(!GetProcessTimes(handle,out long created,out _,out _,out _) || DateTime.FromFileTimeUtc(created).Ticks!=target.Started) {
            handle.Dispose();throw new IOException("Émulateur fermé.");
        }
    }
    public byte[] Read(ulong address,int count) {
        if(count<1 || count>4096) throw new ArgumentOutOfRangeException(nameof(count));
        var bytes=new byte[count];
        if(ReadInto(address,bytes,count)!=count) throw new IOException("Mémoire indisponible.");
        return bytes;
    }
    internal int ReadInto(ulong address,byte[] bytes,int count) {
        ReadProcessMemory(handle,(nint)address,bytes,(nuint)count,out nuint read);
        return (int)read;
    }
    internal IEnumerable<MemoryRegion> Regions() {
        ulong address=0;
        for(int i=0;i<50000 && address<0x7FFFFFFF0000;i++) {
            if(VirtualQueryEx(handle,(nint)address,out var region,(nuint)Marshal.SizeOf<MemoryBasicInformation>())==0) yield break;
            ulong start=(ulong)region.BaseAddress,size=(ulong)region.RegionSize,next=start+size;
            if(size==0 || next<=address) yield break;
            if(region.State==0x1000 && (region.Protect&0x100)==0 && (region.Protect&0xEE)!=0)
                yield return new(start,size);
            address=next;
        }
    }
    public void Dispose()=>handle.Dispose();
    [StructLayout(LayoutKind.Sequential)] private struct MemoryBasicInformation {
        public nint BaseAddress,AllocationBase;
        public uint AllocationProtect;
        public nuint RegionSize;
        public uint State,Protect,Type;
    }
    [DllImport("kernel32.dll",SetLastError=true)] private static extern SafeProcessHandle OpenProcess(uint access,bool inherit,int id);
    [DllImport("kernel32.dll",SetLastError=true)] private static extern bool ReadProcessMemory(SafeProcessHandle process,nint address,[Out] byte[] bytes,nuint size,out nuint read);
    [DllImport("kernel32.dll",SetLastError=true)] private static extern nuint VirtualQueryEx(SafeProcessHandle process,nint address,out MemoryBasicInformation info,nuint length);
    [DllImport("kernel32.dll",SetLastError=true)] private static extern bool GetProcessTimes(SafeProcessHandle process,out long creation,out long exit,out long kernel,out long user);
}
