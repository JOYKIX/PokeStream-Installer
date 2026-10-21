using System.Runtime.InteropServices;
using System.Buffers.Binary;
using Ryujinx.HLE.HOS.Kernel.Process;
using Ryujinx.HLE.Loaders.Processes;
using Ryujinx.Cpu.Jit;
const ulong main=0x8004000,heap=0x100000000,party=heap+0x450C68B0;
var table=new byte[16*1024*1024];var pins=new List<GCHandle>{GCHandle.Alloc(table,GCHandleType.Pinned)};
void Map(ulong guest,byte[] bytes){var pin=GCHandle.Alloc(bytes,GCHandleType.Pinned);pins.Add(pin);BinaryPrimitives.WriteUInt64LittleEndian(table.AsSpan((int)(guest>>12)*8),unchecked((ulong)pin.AddrOfPinnedObject()-guest));}
var code=new byte[4096];BinaryPrimitives.WriteUInt32LittleEndian(code.AsSpan(4),0x100);BinaryPrimitives.WriteUInt32LittleEndian(code.AsSpan(0x100),0x30444F4D);Map(main,code);
var team=File.ReadAllBytes(args[0]);var data=new byte[8192];int offset=(int)(party&4095);team.CopyTo(data,offset);data[offset+6*344]=1;Map(party&~4095UL,data[..4096]);Map((party&~4095UL)+4096,data[4096..]);
var process=new KProcess(new MemoryManagerHostTracked((nint)pins[0].AddrOfPinnedObject()),heap);
var version=new ProcessResult();var info=new ProcessTamperInfo(process,new[]{0x8000000UL,main},heap);
Console.WriteLine("READY");Console.Out.Flush();Thread.Sleep(TimeSpan.FromMinutes(2));
GC.KeepAlive(process);GC.KeepAlive(version);GC.KeepAlive(info);foreach(var pin in pins)pin.Free();
namespace Ryujinx.HLE.HOS.Kernel.Process {
    class KProcess {public int _threadCount=1;public ulong TitleId{get;}=0x0100ABF008968000;public ulong Pid{get;}=81;public ulong _entrypoint=0x8000000;public Context Context{get;}public PageTable MemoryManager{get;}public KProcess(object manager,ulong heap){Context=new(manager);MemoryManager=new(heap);}}
    class Context(object manager){public object _memoryManager=manager;}
    class PageTable(ulong heap){public ulong HeapRegionStart{get;}=heap;}
    class ProcessTamperInfo(KProcess process,ulong[] addresses,ulong heap){public KProcess Process{get;}=process;public ulong[] CodeAddresses{get;}=addresses;public ulong HeapAddress{get;}=heap;}
}
namespace Ryujinx.HLE.Loaders.Processes {class ProcessResult{public ulong ProgramId=0x0100ABF008968000;public ulong ProcessId=81;public string DisplayVersion="1.3.2";}}
namespace Ryujinx.Cpu.Jit {class MemoryManagerHostTracked(nint pointer){public NativePageTable _nativePageTable=new(pointer);}class NativePageTable(nint pointer){public Block _nativePageTable=new(pointer);}class Block(nint pointer){public nint _pointer=pointer;}}
