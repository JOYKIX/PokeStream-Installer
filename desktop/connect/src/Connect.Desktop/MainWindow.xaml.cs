using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Win32;
namespace PokeStream.Connect;

public partial class MainWindow : Window {
    private static readonly string Site=Environment.GetEnvironmentVariable("POKESTREAM_SITE")??"http://127.0.0.1:47653";
    private static readonly string Folder=AppPaths.Data;
    private static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web);
    private readonly HttpClient http=new(){Timeout=TimeSpan.FromSeconds(10)};
    private readonly CancellationTokenSource lifetime=new();
    private readonly Dictionary<string,string> names;
    private readonly Dictionary<string,string> englishNames=JsonSerializer.Deserialize<Dictionary<string,string>>(Resource("names.en.json"))!;
    private Credential? credential;
    private bool subscriptionRequired,linked,paused,refreshingChoices,requireChoice;
    private DateTimeOffset pairingUntil,nextPairCheck;
    private NuzlockeJournal? journal;
    private bool nuzlocke,resetPending;
    private int? forcedTotal;
    private int resetVersion;
    private string? journalScene;
    private string lastSent="",lastShown="";
    private Task? networkTick;
    private TeamReading? latestDetected;
    private DateTime nextNetworkTick;
    private string? sceneId;
    private EmulatorProcess? selected,attached;
    private EmulatorProcess[] choices=[];
    private bool rescanRequested;
    private DateTime nextEmulatorSearch;
    private EmulatorReader? reader;
    private CitraRpcReader? citraReader;
    private MgbaReader? mgbaReader;
    private SwitchGdbReader? switchReader;
    private bool switchReaderResetRequested;
    private SaveWatcher? saves;
    private readonly ReadingPolicy reading=new(Path.Combine(Folder,"observed-types.json"));
    private string? savePath,gameKey,sourceLabel;
    private int selectionVersion;
    private DateTime nextSaveDiscovery,nextProgressRead;
    private Task<SavedParty?>? progressRead;
    private SavedParty? lastProgress;
    private readonly Dictionary<string,string> savedPaths=new(StringComparer.Ordinal);
    private record SaveOption(SavedParty Saved) { public string DisplayName=>L.GameName(GameNames.For(Saved.Version))+" · "+Saved.SavedAt.ToLocalTime().ToString("g"); }
    private string SaveScope=>(sourceLabel??"file")+"/"+(gameKey??"unknown");
    private void ClearSaveChoices() {
        refreshingChoices=true;SaveChoice.ItemsSource=null;SaveChoice.Visibility=Visibility.Collapsed;refreshingChoices=false;
    }
    private void SetGame(string key) {
        if(gameKey==key)return;
        gameKey=key;lastProgress=null;nextProgressRead=default;selectionVersion++;reading.Reset();lastSent="";lastShown="";ShowTeam(null);
        savePath=savedPaths.GetValueOrDefault(SaveScope);nextSaveDiscovery=default;ClearSaveChoices();
    }
    private void SaveChoice_Changed(object sender,SelectionChangedEventArgs e) {
        if(refreshingChoices || SaveChoice.SelectedItem is not SaveOption option)return;
        SelectSave(option.Saved);
    }
    private void SelectSave(SavedParty saved) {
        var key=GameIdentity.FromVersion(saved.Version);
        if(key==null || selected!=null && !GameIdentity.Supports(selected.Label,key) || gameKey!=null && selected!=null && key!=gameKey) {
            GameStatus.Text=L.T("Cette sauvegarde ne correspond pas au jeu ouvert.");return;
        }
        if(gameKey!=key)SetGame(key);
        selectionVersion++;savePath=saved.Path;lastSent="";
        // Preserve the newer live team even when the user chooses its older disk save.
        savedPaths[SaveScope]=saved.Path;
        try {File.WriteAllText(Path.Combine(Folder,"save-paths.json"),JsonSerializer.Serialize(savedPaths,Json));}catch(Exception e)when(e is IOException or UnauthorizedAccessException){}
    }
    private async void SaveFile_Click(object sender,RoutedEventArgs e) {
        var dialog=new OpenFileDialog{Title=L.T("Choisir la sauvegarde du jeu"),Filter=L.T("Sauvegardes (*.sav;*.dsv;main)|*.sav;*.dsv;main|Tous les fichiers|*.*"),CheckFileExists=true};
        if(dialog.ShowDialog()!=true)return;
        int revision=selectionVersion;
        try {
            var watcher=await SaveTool();var saved=await watcher.Read(dialog.FileName,lifetime.Token);
            if(revision!=selectionVersion)return;
            if(saved==null){GameStatus.Text=L.T("Sauvegarde incomplète ou non prise en charge.");return;}
            SelectSave(saved);ClearSaveChoices();
        }catch(OperationCanceledException)when(lifetime.IsCancellationRequested){}
        catch(Exception error)when(error is IOException or UnauthorizedAccessException){GameStatus.Text=L.T("Lecture impossible. Réessaie après une sauvegarde en jeu.");}
    }
    private Task<SaveWatcher>? preparingSaveTool;
    private Task<SaveWatcher> SaveTool()=>preparingSaveTool??=Task.Run(()=>new SaveWatcher(SaveReaderTool.Extract(Folder)),lifetime.Token);
    private async Task<SavedParty?> ReadSave(bool allowDiscovery=true) {
        int revision=selectionVersion;var target=selected;
        try {
            saves??=await SaveTool();
            if(revision!=selectionVersion)return null;
            if(savePath==null && target!=null && (nextSaveDiscovery==default || allowDiscovery && DateTime.UtcNow>=nextSaveDiscovery)) {
                nextSaveDiscovery=DateTime.UtcNow.AddSeconds(15);
                string? directory=null;try{using var p=Process.GetProcessById(target.Id);directory=Path.GetDirectoryName(p.MainModule?.FileName);}catch(Exception e)when(e is Win32Exception or ArgumentException or InvalidOperationException){}
                var files=await Task.Run(()=>SaveDiscovery.Find(target.Label,directory),lifetime.Token);
                var options=new List<SaveOption>();
                foreach(string file in files) {
                    var found=await saves.Read(file,lifetime.Token);
                    if(revision!=selectionVersion || target!=selected)return null;
                    var key=found==null?null:GameIdentity.FromVersion(found.Version);
                    if(found!=null && key!=null && GameIdentity.Supports(target.Label,key) && (gameKey==null || key==gameKey))options.Add(new(found));
                }
                // Automatic choice is allowed only after identifying the game, never just its emulator.
                if(options.Count==1 && savePath==null && gameKey!=null){SelectSave(options[0].Saved);revision=selectionVersion;}
                if(options.Count>0) {
                    refreshingChoices=true;SaveChoice.ItemsSource=options;SaveChoice.SelectedItem=options.FirstOrDefault(o=>o.Saved.Path==savePath);
                    SaveChoice.Visibility=options.Count>1 || savePath==null?Visibility.Visible:Visibility.Collapsed;refreshingChoices=false;
                }
            }
            var path=savePath;
            var saved=path==null?null:await saves.Read(path,lifetime.Token);
            if(revision!=selectionVersion || target!=selected || path!=savePath)return null;
            return saved!=null && GameIdentity.FromVersion(saved.Version)==gameKey?saved:null;
        }catch(Exception error)when(error is IOException or UnauthorizedAccessException){GameStatus.Text=L.T("Sauvegarde indisponible. Réessaie après avoir sauvegardé en jeu.");preparingSaveTool=null;return null;}
    }
    private void PollSavedProgress(bool allowDiscovery=false) {
        if(progressRead?.IsCompleted==true) {
            var saved=progressRead.GetAwaiter().GetResult();progressRead=null;
            if(saved!=null && GameIdentity.FromVersion(saved.Version)==gameKey)lastProgress=saved;
        }
        if(progressRead==null && DateTime.UtcNow>=nextProgressRead) {
            nextProgressRead=DateTime.UtcNow.AddSeconds(4);
            // Disk parsing/discovery must not delay the next live memory sample.
            progressRead=ReadSave(allowDiscovery);
        }
    }
    private PartyFrame SavedBadges(PartyFrame live) {
        PollSavedProgress();
        return ProgressionPolicy.WithSavedBadges(live,lastProgress?.Frame);
    }
    private record Credential(string Id,string Secret);
    private record LinkStatus(string? Scene,string? SceneId,bool Nuzlocke,long SelectionRevision=0,OverlayOption[]? Overlays=null,int Deaths=0);

    public MainWindow() {
        InitializeComponent();Directory.CreateDirectory(Folder);
        names=JsonSerializer.Deserialize<Dictionary<string,string>>(Resource("names.json"))!;
        InitializePresentation();LoadCredential();ShowTeam(null);UpdatePresentation();
        try{var file=Path.Combine(Folder,"save-paths.json");if(File.Exists(file))foreach(var item in JsonSerializer.Deserialize<Dictionary<string,string>>(File.ReadAllText(file),Json)??[])savedPaths[item.Key]=item.Value;}catch(Exception e)when(e is IOException or UnauthorizedAccessException or JsonException){}
        Loaded+=(_,_)=>_=Loop();
        Closed+=(_,_)=>{SavePreferences();lifetime.Cancel();};
    }
    private static string Resource(string suffix) {
        var asm=Assembly.GetExecutingAssembly();
        using var stream=asm.GetManifestResourceStream(asm.GetManifestResourceNames().Single(n=>n.EndsWith(suffix)))!;
        using var input=new StreamReader(stream);return input.ReadToEnd();
    }
    private static void Browse(string url)=>Process.Start(new ProcessStartInfo(url){UseShellExecute=true});
    private void LoadCredential() {
        if(Environment.GetEnvironmentVariable("POKESTREAM_ENGINE_TOKEN") is {} secret && Environment.GetEnvironmentVariable("POKESTREAM_ENGINE_ID") is {} id){credential=new(id,secret);return;}
        try {
            var file=Path.Combine(Folder,"account.bin");
            if(File.Exists(file)) credential=JsonSerializer.Deserialize<Credential>(ProtectedData.Unprotect(File.ReadAllBytes(file),null,DataProtectionScope.CurrentUser),Json);
            if(credential!=null) AccountHint.Text=L.T("Reconnexion à ton aventure…");
        } catch(Exception e) when(e is IOException or CryptographicException or JsonException or UnauthorizedAccessException) {AccountHint.Text=L.T("Réassocie cet appareil pour continuer.");}
    }
    private void SaveCredential() {
        byte[] bytes=JsonSerializer.SerializeToUtf8Bytes(credential,Json);
        try {File.WriteAllBytes(Path.Combine(Folder,"account.bin"),ProtectedData.Protect(bytes,null,DataProtectionScope.CurrentUser));}
        finally {CryptographicOperations.ZeroMemory(bytes);}
    }
    private void Pair_Click(object sender,RoutedEventArgs e) {
        try {
            if(linked || subscriptionRequired){OpenWebsite(Site+"/connect");return;}
            associationRejected=false;
            if(credential==null){credential=new(Guid.NewGuid().ToString(),Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant());SaveCredential();}
            string hash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(credential.Secret))).ToLowerInvariant();
            pairingUntil=DateTimeOffset.UtcNow.AddMinutes(10);nextPairCheck=default;
            Browse(Site+"/connect?mode=account&device="+credential.Id+"&challenge="+hash+"&name="+Uri.EscapeDataString(Environment.MachineName[..Math.Min(Environment.MachineName.Length,60)]));
            AccountHint.Text=L.T("Termine l’association dans ton navigateur.");PairButton.Content=L.T("Rouvrir");
        } catch(Exception error) when(error is IOException or Win32Exception or UnauthorizedAccessException or CryptographicException) {AccountHint.Text=L.T("Impossible d’ouvrir l’association. Réessaie.");}
    }
    private void OpenEmulator_Click(object sender,RoutedEventArgs e)=>LaunchEmulator();
    private void Rescan_Click(object sender,RoutedEventArgs e) {
        if(gameKey!=null)reading.ForgetTypes(gameKey);
        rescanRequested=true;nextEmulatorSearch=default;
        GameStatus.Text=L.T("Recherche demandée…");SessionNav.IsChecked=true;LogActivity(L.T("Recherche manuelle demandée"));
    }
    private void Emulator_Changed(object sender,SelectionChangedEventArgs e) {
        if(!refreshingChoices) {selected=EmulatorChoice.SelectedItem as EmulatorProcess;requireChoice=false;selectionVersion++;}
    }
    private void Pause_Click(object sender,RoutedEventArgs e) {
        if(resetPending)return;
        paused=!paused;lastSent="";UpdatePresentation();
        
    }
    private void Studio_Click(object sender,RoutedEventArgs e)=>OpenWebsite(Site+(sceneId==null?"/studio":"/studio/"+sceneId));
    private void Licenses_Click(object sender,RoutedEventArgs e)=>ShowLicenses();
    private void Devices_Click(object sender,RoutedEventArgs e)=>OpenWebsite(Site+"/connect");
    private HttpRequestMessage Request(HttpMethod method) {
        var req=new HttpRequestMessage(method,Site+"/api/connect/device");
        req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",credential!.Id+"."+credential.Secret);
        req.Headers.Add("X-Connect-Protocol","2");
        req.Headers.Add("X-Connect-Selection",selectionRevision.ToString(System.Globalization.CultureInfo.InvariantCulture));return req;
    }
    private async Task Loop() {
        using var timer=new PeriodicTimer(TimeSpan.FromMilliseconds(100));
        using var commands=WatchLocalCommands();
        var destinationEvents=IpcFolder!=null?ReadDestinationEvents():Task.CompletedTask;
        try {
            while(!lifetime.IsCancellationRequested) {
                try {LocalCommand();await Tick();}
                catch(OperationCanceledException) when(lifetime.IsCancellationRequested){break;}
                catch(InvalidDataException){journalUnavailable=true;NuzlockeStatus.Text=L.T("Historique Nuzlocke illisible. Ferme Connect et restaure le fichier local.");}
                catch(Exception e) when(e is HttpRequestException or TaskCanceledException or JsonException) {serverIssue=true;}
                catch(Exception e) when(e is IOException or UnauthorizedAccessException or Win32Exception or ArgumentException or InvalidOperationException) {readIssue=true;GameStatus.Text=L.T("Lecture indisponible. Vérifie l’émulateur.");}
                UpdatePresentation();WriteLocalStatus();
                timer.Period=TimeSpan.FromMilliseconds(IpcFolder!=null&&selected!=null&&!paused?100:500);
                if(!await timer.WaitForNextTickAsync(lifetime.Token))break;
            }
        } catch(OperationCanceledException) when(lifetime.IsCancellationRequested) { }
        finally {
            lifetime.Cancel();try{await destinationEvents;}catch(OperationCanceledException){}
            if(networkTick!=null)try{await networkTick;}catch(Exception e)when(e is OperationCanceledException or HttpRequestException or JsonException or IOException){}
            reader?.Dispose();citraReader?.Dispose();mgbaReader?.Dispose();switchReader?.Dispose();http.Dispose();lifetime.Dispose();}
    }
    private async Task<TeamReading?> ReadGame() {
        if(switchReaderResetRequested){switchReaderResetRequested=false;switchReader?.Dispose();switchReader=null;}
        // A linked process needs only a liveness check, never a full process scan.
        var available=choices;
        if(rescanRequested || selected==null || !ProcessMemory.IsRunning(selected)) {
            if(rescanRequested || DateTime.UtcNow>=nextEmulatorSearch) {
                nextEmulatorSearch=DateTime.UtcNow.AddSeconds(3);
                available=await Task.Run(ProcessMemory.List,lifetime.Token);
            }
        }
        if(rescanRequested){rescanRequested=false;attached=null;selectionVersion++;}
        if(!available.SequenceEqual(choices)) {
            choices=available;
            if(selected!=null && !available.Contains(selected)) {selected=null;requireChoice=available.Length>0;}
            if(available.Length==0) requireChoice=false;
            if(selected==null && available.Length==1 && !requireChoice) selected=available[0];
            refreshingChoices=true;
            EmulatorChoice.ItemsSource=available;EmulatorChoice.SelectedItem=selected;
            EmulatorChoice.Visibility=available.Length>1 || requireChoice?Visibility.Visible:Visibility.Collapsed;
            refreshingChoices=false;
        }
        if(attached!=selected) {
            reader?.Dispose();reader=null;citraReader?.Dispose();citraReader=null;mgbaReader?.Dispose();mgbaReader=null;switchReader?.Dispose();switchReader=null;attached=null;lastSent="";
            selectionVersion++;
            // Closing an emulator retains the last live team; selecting a new process starts a new source.
            if(selected!=null){sourceLabel=selected.Label;gameKey=null;savePath=null;nextSaveDiscovery=default;reading.Reset();lastShown="";ShowTeam(null);ClearSaveChoices();}
        }
        if(selected==null) {
            GameLabel.Text=available.Length>0?L.T("Choisir un émulateur"):L.T("Aucun jeu détecté");
            GameStatus.Text=available.Length>0?L.T("Plusieurs sources disponibles."):L.T("Lance une partie dans ton émulateur.");
            // Keep an explicit save usable even with the emulator closed.
            if(available.Length>0)return null;
            var savedOnly=await ReadSave();
            return reading.Fallback(savedOnly?.Frame,savedOnly?.SavedAt??default,savedOnly==null?"":GameNames.For(savedOnly.Version),gameKey);
        }
        GameLabel.Text=selected.Label;attached=selected;
        try {using var process=Process.GetProcessById(selected.Id);var titleKey=GameIdentity.FromName(process.MainWindowTitle);if(titleKey!=null&&GameIdentity.Supports(selected.Label,titleKey))SetGame(titleKey);}catch(Exception e)when(e is Win32Exception or ArgumentException or InvalidOperationException){return null;}
        int revision=selectionVersion;
        var target=selected;PartyFrame? live=null;string name="";
        if(target.Label is "melonDS" or "DeSmuME") {
            reader??=new EmulatorReader(target);var current=reader;
            var found=await Task.Run(()=>current.Read(lifetime.Token),lifetime.Token);
            live=found?.Frame;name=found?.Profile.Name??"";
        } else if(target.Label=="mGBA") {
            mgbaReader??=new MgbaReader(target);var current=mgbaReader;
            var found=await Task.Run(()=>current.Read(lifetime.Token),lifetime.Token);live=found?.Frame;name=found?.Name??"";
        } else if(target.Label is "Ryujinx" or "Citron") {
            switchReader??=new SwitchGdbReader(target,target.Label=="Ryujinx"?preferences.RyujinxGdbPort:preferences.CitronGdbPort);var current=switchReader;
            var found=await Task.Run(()=>current.Read(lifetime.Token),lifetime.Token);live=found?.Frame;name=found?.Name??"";
        } else if((target.Label is "Citra" or "Azahar")) {
            citraReader??=new CitraRpcReader(target);var current=citraReader;
            var found=await Task.Run(()=>current.Read(gameKey,lifetime.Token),lifetime.Token);live=found?.Frame;name=found?.Profile.Name??"";
        }
        if(target!=selected || revision!=selectionVersion)return null;
        if(live!=null){
            var key=GameIdentity.FromName(name);if(key==null)return null;SetGame(key);
            if(live.Badges==null)live=SavedBadges(live);
            GameLabel.Text=L.GameName(name);GameStatus.Text=target.Label+(live.InBattle?L.T(" · Combat en direct"):L.T(" · Lecture directe"));
            return reading.Live(live,name,DateTimeOffset.UtcNow,key);
        }
        if(reading.DuringUpdate(DateTimeOffset.UtcNow) is {} updating) {
            GameLabel.Text=L.GameName(updating.GameName);GameStatus.Text=target.Label+L.T(" · Mise à jour de l’équipe…");return updating;
        }
        // Never await disk discovery/conversion on the live polling path.
        PollSavedProgress(allowDiscovery:true);var saved=lastProgress;
        var fallback=reading.Fallback(saved?.Frame,saved?.SavedAt??default,saved==null?"":GameNames.For(saved.Version),gameKey);
        if(fallback!=null){GameLabel.Text=L.GameName(fallback.GameName);GameStatus.Text=fallback.Source==ReadingSource.Save?L.T("Sauvegarde du ")+fallback.ObservedAt.ToLocalTime().ToString("g"):(target.Label is "Citra" or "Azahar")?target.Label+L.T(" · Liaison conservée · Lecture retardée"):L.T("Lecture interrompue · Dernière équipe conservée");}
        else GameStatus.Text=(target.Label is "Citra" or "Azahar")?L.T("Sauvegarde en jeu pour synchroniser ton équipe."):L.T("Choisis ta sauvegarde pour suivre ta partie.");
        if((target.Label is "Ryujinx" or "Citron") && switchReader!=null)
            GameStatus.Text=L.T(switchReader.Status)+(switchReader.Port>0?" · "+switchReader.Port:"");
        return fallback;
    }
    private async Task Tick() {
        var detected=await ReadGame();
        readIssue=false;latestDetected=detected;
        if(detected!=null) {
            string shown=JsonSerializer.Serialize(detected.Frame,Json);
            if(shown!=lastShown){ShowTeam(detected.Frame);lastShown=shown;}
        }
        ObserveReading(detected);
        // Reading/Nuzlocke observation continues while a server request is in flight.
        // Only one request chain runs at a time; the next send takes the newest sample.
        if(networkTick?.IsCompleted==true) {
            var completed=networkTick;networkTick=null;await completed;
        }
        if(networkTick==null && !switchingOverlay && (IpcFolder!=null || DateTime.UtcNow>=nextNetworkTick)) {
            nextNetworkTick=DateTime.UtcNow.AddSeconds(1);
            networkTick=SyncLatest();
        }
    }
    private async Task SyncLatest() {
        if(switchingOverlay)return;
        int revision=selectionVersion,requestVersion=linkVersion;var source=selected;
        if(IpcFolder==null && credential!=null && DateTimeOffset.UtcNow>=nextPairCheck) {
            nextPairCheck=DateTimeOffset.UtcNow.AddSeconds(3);
            using var request=Request(HttpMethod.Get);using var response=await http.SendAsync(request,lifetime.Token);
            if(requestVersion!=linkVersion || switchingOverlay)return;
            if(response.IsSuccessStatusCode) {
                var status=await response.Content.ReadFromJsonAsync<LinkStatus>(Json,lifetime.Token)??throw new JsonException();
                if(requestVersion!=linkVersion || switchingOverlay)return;
                ApplyStatus(status);requestVersion=linkVersion;
            } else if(response.StatusCode==HttpStatusCode.Forbidden) {
                RequireSubscription();return;
            } else if(response.StatusCode==HttpStatusCode.Unauthorized) {
                ForgetDestination();
                if(pairingUntil<DateTimeOffset.UtcNow)nextPairCheck=DateTimeOffset.MaxValue;
                return;
            } else response.EnsureSuccessStatusCode();
        }
        if(subscriptionRequired || destinationUnknown || switchingOverlay || !linked || sceneId==null)return;
        var detected=revision==selectionVersion && source==selected && source==attached?latestDetected:null;
        ObserveReading(detected);
        if(paused && !resetPending || detected==null && !resetPending || journal==null)return;
        if(awaitingDestinationFrame && !resetPending && detected?.Source is (ReadingSource.Retained or ReadingSource.Updating))return;
        int? deaths=nuzlocke?journal.Deaths:null;
        string payload=resetPending
            ? JsonSerializer.Serialize(new {sceneId,deaths=journal.Deaths},Json)
            : JsonSerializer.Serialize(DisplayFrame.From(sceneId,detected!.Frame,deaths),Json);
        if(payload==lastSent || detected?.Source==ReadingSource.Updating && !resetPending)return;
        int sentResetVersion=resetVersion;string sentScene=sceneId;long sentSelection=selectionRevision;
        using var post=Request(HttpMethod.Post);post.Content=new StringContent(payload,Encoding.UTF8,"application/json");
        using var result=await http.SendAsync(post,lifetime.Token);
        if(requestVersion!=linkVersion || switchingOverlay)return;
        if(result.StatusCode==HttpStatusCode.Unauthorized){ForgetDestination();return;}
        if(result.StatusCode==HttpStatusCode.Forbidden){RequireSubscription();return;}
        if(result.StatusCode==HttpStatusCode.Conflict){destinationUnknown=true;nextPairCheck=default;lastSent="";return;}
        result.EnsureSuccessStatusCode();
        var reply=await result.Content.ReadFromJsonAsync<LinkStatus>(Json,lifetime.Token)??throw new JsonException();
        if(requestVersion!=linkVersion || switchingOverlay)return;
        ApplyStatus(reply);
        if(sceneId==sentScene && selectionRevision==sentSelection) {
            lastSent=payload;lastUpload=DateTimeOffset.UtcNow;
            if(!resetPending)awaitingDestinationFrame=false;
            if(sentResetVersion==resetVersion)resetPending=false;
        }
    }
    private void ApplyStatus(LinkStatus status) {
        if(status.Deaths is <0 or >9999 || status.SelectionRevision<0 || status.SceneId!=null && !Guid.TryParse(status.SceneId,out _))throw new JsonException();
        bool changed=sceneId!=status.SceneId || selectionRevision!=status.SelectionRevision;
        if(changed) {
            linkVersion++;pendingJournalBaseline=null;awaitingDestinationFrame=status.SceneId!=null;journal=null;journalScene=null;lastSent="";resetPending=false;forcedTotal=null;
            lastUpload=null;journalUnavailable=false;
        }
        sceneId=status.SceneId;selectionRevision=status.SelectionRevision;
        if(nuzlocke!=status.Nuzlocke)lastSent="";
        nuzlocke=sceneId!=null && status.Nuzlocke;
        if(!nuzlocke){resetPending=false;forcedTotal=null;}
        subscriptionRequired=false;linked=true;associationRejected=false;serverIssue=false;destinationUnknown=false;
        AccountLabel.Text=status.Scene??L.T("Aucun overlay sélectionné");
        AccountHint.Text=sceneId==null?L.T("Choisis un overlay pour synchroniser le jeu."):L.T("Compte associé");
        PairButton.Content=L.T("Gérer");
        if(status.Overlays!=null)overlayOptions=status.Overlays;
        RefreshOverlayChoices();
        nextPairCheck=DateTimeOffset.UtcNow.AddSeconds(2);
        if(sceneId!=null && journalScene!=sceneId) {
            // Separate files per overlay. Never replace an unreadable history.
            journalUnavailable=true;journal=null;
            var historyFolder=Path.Combine(Folder,"nuzlocke");
            bool hasHistory=File.Exists(Path.Combine(historyFolder,Guid.Parse(sceneId).ToString("D")+".json"));
            journal=new NuzlockeJournal(historyFolder,Guid.Parse(sceneId));
            pendingJournalBaseline=!hasHistory && nuzlocke?status.Deaths:null;
            journalScene=sceneId;journalUnavailable=false;
        }
    }

    private void ObserveReading(TeamReading? detected) {
        ResetNuzlockeButton.IsEnabled=linked && sceneId!=null && !switchingOverlay && !destinationUnknown && nuzlocke && journal!=null;
        CorrectDeathsButton.IsEnabled=ResetNuzlockeButton.IsEnabled;
        if(switchingOverlay || destinationUnknown || !linked)return;
        if(journal==null){NuzlockeStatus.Text=L.T("Associe une aventure pour activer le suivi.");return;}
        if(resetPending) {
            NuzlockeStatus.Text=L.T("Synchronisation du compteur…");
        } else {
            if(!paused && detected!=null && detected.Source is not (ReadingSource.Retained or ReadingSource.Updating))
                {
                journal.Observe(detected.Frame.Team,nuzlocke);
                if(nuzlocke && pendingJournalBaseline is int baseline) {journal.CorrectTotal(Math.Max(baseline,journal.Deaths));pendingJournalBaseline=null;}
            }
            if(forcedTotal is int total){pendingJournalBaseline=null;journal.CorrectTotal(total);forcedTotal=null;lastSent="";resetVersion++;resetPending=true;}
            NuzlockeStatus.Text=!nuzlocke?L.T("Nuzlocke désactivé dans le studio"):
                journal.Deaths+L.T(" mort(s) · ")+(detected?.Frame.Team.All(p=>p.Egg || p.Pid!=null)==true?L.T("Suivi automatique"):L.T("Compteur manuel"));
        }
        BadgeStatus.Text=detected?.Frame.Badges is {} badges
            ? badges.Length+L.T(" badge(s) · ")+(detected.Frame.BadgesFromSave?L.T("Dernière sauvegarde"):L.T("En direct"))
            : L.T("Badges : sauvegarde compatible requise");
    }
    private void ResetNuzlocke_Click(object sender,RoutedEventArgs e) {
        if(journal==null || !nuzlocke || !linked || switchingOverlay || destinationUnknown)return;
        var targetJournal=journal;
        if(!ConfirmReset() || !ReferenceEquals(targetJournal,journal))return;
        try {
            pendingJournalBaseline=null;journal.Reset();resetVersion++;forcedTotal=null;resetPending=true;paused=true;PauseButton.Content=L.T("Reprendre");lastSent="";
            NuzlockeStatus.Text=L.T("Synchronisation du compteur…");
        }catch(Exception error)when(error is IOException or UnauthorizedAccessException){NuzlockeStatus.Text=L.T("Impossible d’enregistrer la remise à zéro.");}
    }
    private void CorrectDeaths_Click(object sender,RoutedEventArgs e) {
        if(journal==null || !nuzlocke || !linked || switchingOverlay || destinationUnknown)return;
        EditDeathCount();
    }
    private void RequireSubscription() {
        linked=false;subscriptionRequired=true;destinationUnknown=false;lastSent="";nextPairCheck=DateTimeOffset.UtcNow.AddSeconds(30);
        AccountHint.Text=L.T("Un abonnement Patreon Connect actif est nécessaire.");PairButton.Content=L.T("Abonnement");
        
    }
    public void RenderPreview(string file) {
        var root=(FrameworkElement)Content;root.SetValue(Control.BackgroundProperty,Background);
        root.Width=1180;root.Height=880;root.Measure(new Size(1180,880));root.Arrange(new Rect(0,0,1180,880));root.UpdateLayout();
        var image=new RenderTargetBitmap(1180,880,96,96,PixelFormats.Pbgra32);image.Render(root);
        var png=new PngBitmapEncoder();png.Frames.Add(BitmapFrame.Create(image));using var output=File.Create(file);png.Save(output);
    }
}
