using System.Diagnostics;
using System.IO;
using System.Text.Json;
namespace PokeStream.Connect;
public partial class MainWindow {
    private string? localCommandId,localCommandError,lastLocalStatus;
    private int localCommandPending=1;
    private DateTime nextParentCheck;
    private FileSystemWatcher? WatchLocalCommands(){
        if(IpcFolder is not {} folder)return null;
        Directory.CreateDirectory(folder);
        var watcher=new FileSystemWatcher(folder,"command.json"){NotifyFilter=NotifyFilters.LastWrite|NotifyFilters.FileName|NotifyFilters.CreationTime};
        watcher.Changed+=(_,_)=>Interlocked.Exchange(ref localCommandPending,1);
        watcher.Created+=(_,_)=>Interlocked.Exchange(ref localCommandPending,1);
        watcher.Renamed+=(_,_)=>Interlocked.Exchange(ref localCommandPending,1);
        watcher.Error+=(_,_)=>Interlocked.Exchange(ref localCommandPending,1);
        watcher.EnableRaisingEvents=true;return watcher;
    }
    private async Task ReadDestinationEvents(){
        using var client=new System.Net.Http.HttpClient{Timeout=Timeout.InfiniteTimeSpan};
        int failures=0;
        while(!lifetime.IsCancellationRequested){
            try{
                using var request=Request(System.Net.Http.HttpMethod.Get);
                request.RequestUri=new Uri(Site+"/api/connect/device/events");
                using var response=await client.SendAsync(request,System.Net.Http.HttpCompletionOption.ResponseHeadersRead,lifetime.Token);
                response.EnsureSuccessStatusCode();
                using var input=new StreamReader(await response.Content.ReadAsStreamAsync(lifetime.Token));
                while(await input.ReadLineAsync(lifetime.Token) is {} line){
                    if(!line.StartsWith("data: ",StringComparison.Ordinal))continue;
                    var status=JsonSerializer.Deserialize<LinkStatus>(line[6..],Json)??throw new JsonException();
                    ApplyStatus(status);failures=0;
                }
                serverIssue=true;destinationUnknown=true;
            }catch(OperationCanceledException)when(lifetime.IsCancellationRequested){break;}
            catch(Exception error)when(error is System.Net.Http.HttpRequestException or IOException or JsonException or InvalidOperationException or OperationCanceledException){serverIssue=true;}
            try{await Task.Delay(Math.Min(5000,500*(++failures)),lifetime.Token);}catch(OperationCanceledException){break;}
        }
    }
    private static string? IpcFolder=>Environment.GetEnvironmentVariable("POKESTREAM_IPC_DIR");
    public void StartLocalEngine(){_=Loop();}
    private void LocalCommand(){
        if(IpcFolder is not {} folder)return;
        if(DateTime.UtcNow>=nextParentCheck && int.TryParse(Environment.GetEnvironmentVariable("POKESTREAM_PARENT_PID"),out int parent)){
            nextParentCheck=DateTime.UtcNow.AddSeconds(2);
            try{using var p=Process.GetProcessById(parent);if(p.HasExited){System.Windows.Application.Current.Shutdown();return;}}
            catch(ArgumentException){System.Windows.Application.Current.Shutdown();return;}
        }
        if(Interlocked.Exchange(ref localCommandPending,0)==0)return;
        try {
            string file=Path.Combine(folder,"command.json");if(!File.Exists(file))return;
            using var doc=JsonDocument.Parse(File.ReadAllText(file));var root=doc.RootElement;
            string? id=root.GetProperty("id").GetString();if(id==localCommandId)return;
            localCommandId=id;localCommandError=null;
            switch(root.GetProperty("action").GetString()){
                case "pause":paused=true;lastSent="";break;
                case "resume":paused=false;lastSent="";break;
                case "rescan":rescanRequested=true;nextEmulatorSearch=default;break;
                case "launch":LaunchEmulator();break;
                case "choose-emulator":ChooseEmulator();break;
                case "choose-save":SaveFile_Click(this,new System.Windows.RoutedEventArgs());break;
                case "clear-save":savePath=null;nextSaveDiscovery=default;ClearSaveChoices();break;
                case "emulator":
                    int pid=root.GetProperty("value").GetInt32();
                    selected=choices.FirstOrDefault(p=>p.Id==pid);requireChoice=false;selectionVersion++;break;
                case "ports":
                    var ports=root.GetProperty("value");
                    RyujinxPort.Text=PortText(ports.GetProperty("ryujinx").GetInt32());CitronPort.Text=PortText(ports.GetProperty("citron").GetInt32());
                    ApplyGdbPorts_Click(this,new System.Windows.RoutedEventArgs());break;
                case "deaths":
                    if(journal!=null&&nuzlocke)forcedTotal=Math.Clamp(root.GetProperty("value").GetInt32(),0,9999);break;
            }
        } catch(Exception e)when(e is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException or System.ComponentModel.Win32Exception){localCommandError="Commande impossible. Réessaie.";}
    }
    private void WriteLocalStatus(){
        if(IpcFolder is not {} folder)return;
        try{
            Directory.CreateDirectory(folder);
            var state=new {
                pid=Environment.ProcessId,paused,title=L.Original(SyncLabel.Text),hint=L.Original(HintLabel.Text),
                reading=L.Original(ReadingState.Text),game=L.Original(GameLabel.Text),emulator=selected?.Label,selectedPid=selected?.Id??0,
                emulators=choices.Select(p=>new {id=p.Id,label=p.Label}),activity=activity.Select(a=>new {time=a.Time,message=a.Source}),
                lastSync=LastSyncLabel.Text,badges=BadgeValue.Text,deaths=NuzlockeValue.Text,save=SavePathLabel.Text,
                emulatorPath=EmulatorPathLabel.Text,ryujinxPort=preferences.RyujinxGdbPort,citronPort=preferences.CitronGdbPort,
                commandId=localCommandId,commandError=localCommandError
            };
            string payload=JsonSerializer.Serialize(state,Json);if(payload==lastLocalStatus)return;
            string target=Path.Combine(folder,"status.json"),temp=target+".tmp";
            File.WriteAllText(temp,payload[..^1]+",\"updatedAt\":\""+DateTimeOffset.UtcNow.ToString("O")+"\"}");File.Move(temp,target,true);lastLocalStatus=payload;
        }catch(Exception e)when(e is IOException or UnauthorizedAccessException){}
    }
}
