using System.Windows;
namespace PokeStream.Connect;
public partial class App : Application {
    private Mutex? instance, legacyInstance;
    protected override void OnStartup(StartupEventArgs e) {
        base.OnStartup(e);
        L.Initialize();
        if(e.Args.Length==3 && e.Args[0]=="--locate-ryujinx") {
            try {
                int pid=int.Parse(e.Args[1]);long started=long.Parse(e.Args[2]);
                var target=ProcessMemory.List().Single(p=>p.Label=="Ryujinx"&&p.Id==pid&&p.Started==started);
                using var reader=new RyujinxReader(target);using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(12));
                Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(reader.Inspect(timeout.Token)));Shutdown(0);
            }catch(Exception error)when(error is not OutOfMemoryException){Console.WriteLine("null");Shutdown(2);}
            return;
        }
        if(e.Args.Length==2 && e.Args[0]=="--render") {
            new MainWindow().RenderPreview(e.Args[1]);Shutdown();return;
        }
        instance=new Mutex(true,@"Local\PokeStream.Connect.Desktop",out bool first);
        if(!first){MessageBox.Show(L.T("Connect est déjà ouvert."),"PokeStream Connect");Shutdown();return;}
        legacyInstance=new Mutex(true,AppPaths.LegacyMutex,out bool legacyFirst);
        if(!legacyFirst){MessageBox.Show(L.T("Connect est déjà ouvert."),"PokeStream Connect");Shutdown();return;}
        try { AppPaths.Migrate(); }
        catch(Exception error) when(error is System.IO.IOException or UnauthorizedAccessException) {
            MessageBox.Show(L.T("Impossible de reprendre les réglages. Ferme Connect et réessaie."),"PokeStream Connect");Shutdown();return;
        }
        L.Initialize();
        if(e.Args.Contains("--local")){
            var worker=new MainWindow();MainWindow=worker;ShutdownMode=ShutdownMode.OnExplicitShutdown;worker.StartLocalEngine();return;
        }
        MainWindow=new MainWindow();MainWindow.Show();
    }
    protected override void OnExit(ExitEventArgs e){legacyInstance?.Dispose();instance?.Dispose();base.OnExit(e);}
}
