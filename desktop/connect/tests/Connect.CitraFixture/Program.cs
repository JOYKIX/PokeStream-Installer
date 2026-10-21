// Original loopback test server. Not an emulator; serves only a synthetic PK6 fixture.
using System.Net;
using System.Net.Sockets;
using System.Buffers.Binary;
var party=File.ReadAllBytes(args[0]);var memory=new Dictionary<uint,byte>();
for(int i=0;i<232;i++)memory[0x08CF727C+(uint)i]=party[i];for(int i=0;i<22;i++)memory[0x08CF727C+344+(uint)i]=party[232+i];
using var socket=new UdpClient(new IPEndPoint(IPAddress.Loopback,45987));using var timer=new CancellationTokenSource(TimeSpan.FromMinutes(1));Console.WriteLine("READY");Console.Out.Flush();
try {while(!timer.IsCancellationRequested){
    var request=await socket.ReceiveAsync(timer.Token);var bytes=request.Buffer;
    if(bytes.Length!=24||BinaryPrimitives.ReadUInt32LittleEndian(bytes)!=1||BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(8))!=1)continue;
    uint address=BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(16));int count=(int)BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(20));if(count is <1 or >32)continue;
    var response=new byte[16+count];bytes.AsSpan(0,12).CopyTo(response);BinaryPrimitives.WriteUInt32LittleEndian(response.AsSpan(12),(uint)count);
    for(int i=0;i<count;i++)response[16+i]=memory.GetValueOrDefault(address+(uint)i);
    await socket.SendAsync(response,request.RemoteEndPoint,timer.Token);
}}catch(OperationCanceledException){}
