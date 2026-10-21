using PokeStream.Connect;
using System.Text.Json;
var targets=ProcessMemory.List();
if(args.Length>0) targets=targets.Where(p=>p.Id==int.Parse(args[0])).ToArray();
Console.WriteLine(JsonSerializer.Serialize(targets));
if(targets.Length!=1) {Environment.ExitCode=2;return;}
var target=targets[0];
using var ds=target.Label is "melonDS" or "DeSmuME"?new EmulatorReader(target){Diagnostic=args.Contains("--trace")?Console.WriteLine:null}:null;
using var gba=target.Label=="mGBA"?new MgbaReader(target):null;
using var citra=target.Label=="Citra"?new CitraRpcReader(target):null;
using var ryu=target.Label=="Ryujinx"?new RyujinxReader(target):null;
if(args.Contains("--mapping")) {
    var map=JsonSerializer.Deserialize<RyujinxReader.Mapping>(File.ReadAllText(args[Array.IndexOf(args,"--mapping")+1]))!;
    var found=ryu!.ReadLocated(map);Console.WriteLine(JsonSerializer.Serialize(found.Frame));return;
}
using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(40));
for(int i=0;i<40;i++) {
    PartyFrame? frame=ds?.Read(timeout.Token)?.Frame??gba?.Read(timeout.Token)?.Frame??citra?.Read()?.Frame??ryu?.Read(timeout.Token)?.Frame;
    if(frame!=null) {Console.WriteLine(args.Contains("--details")?JsonSerializer.Serialize(frame):JsonSerializer.Serialize(new{frame.Game,count=frame.Team.Length,species=frame.Team.Select(p=>p.Species),levels=frame.Team.Select(p=>p.Level)}));return;}
    await Task.Delay(1000);
}
Console.Error.WriteLine("No stable supported party found.");Environment.ExitCode=1;
