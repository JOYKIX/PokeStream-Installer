using System.Buffers.Binary;
using System.ComponentModel;
namespace PokeStream.Connect;

// A single persistent GDB session for both Switch emulators. Encrypted party
// records, slot pointers and identities use the same Core validators as before.
public sealed class SwitchGdbReader(EmulatorProcess target,int port):IDisposable {
    private SwitchGdbConnection? connection;
    private SwitchGdbConnection.Info? info;
    private SwitchProfile? profile;
    private ulong main;
    private byte[]? signature;
    private readonly CombatReadingPolicy combat=new();
    private DateTime nextConnect,nextInfo,nextProfile;
    private int failures;
    private bool stopped;
    private Exception? readFailure;
    private (SwitchProfile Profile,SwitchGdbConnection.Module Module)[]? probes;
    private int probeIndex;
    private readonly List<(SwitchProfile Profile,ulong Main,byte[] Signature)> matches=[];
    public string Status { get; private set; }="Connexion au serveur GDB…";
    public int Port=>port;
    public (string Name,PartyFrame Frame)? Read(CancellationToken cancellation) {
        cancellation.ThrowIfCancellationRequested();
        if(port is <1 or >65535){Status="Renseigne le port GDB dans Réglages.";return null;}
        if(stopped || DateTime.UtcNow<nextConnect)return null;
        bool locating=false;readFailure=null;
        try {
            if(!ProcessMemory.IsRunning(target))throw new IOException("Émulateur fermé.");
            connection??=new(target,port,cancellation);
            connection.BeginFrame();
            if(info==null || DateTime.UtcNow>=nextInfo) {
                locating=true;var current=connection.GetInfo();locating=false;
                if(current.Key!=info?.Key){ClearProfile();info=current;}
                nextInfo=DateTime.UtcNow.AddSeconds(5);
            }
            if(profile==null) {
                if(DateTime.UtcNow<nextProfile)return null;
                nextProfile=DateTime.UtcNow.AddSeconds(3);
                var profiles=SwitchPartyReader.Profiles.Where(p=>p.TitleId==info!.TitleId)
                    .GroupBy(p=>(p.Layout,p.Offset)).Select(g=>g.First()).ToArray();
                if(profiles.Length==0){Status="Jeu Switch non pris en charge en direct.";return null;}
                var named=info!.Modules.Where(m=>m.Name.Equals("main",StringComparison.OrdinalIgnoreCase) || m.Name.Equals("main.nso",StringComparison.OrdinalIgnoreCase)).ToArray();
                var modules=named.Length==1?named:info.Modules.OrderBy(m=>m.Address).ToArray();

                // Heap-only layouts need a code signature as a session anchor;
                // main's base is irrelevant for them. Other layouts are accepted
                // only when exactly one declared module yields a valid team.
                if(profiles.All(p=>p.Layout=="swsh"))modules=[modules[0]];
                probes??=modules.SelectMany(m=>profiles.Select(p=>(p,m))).ToArray();
                while(probeIndex<probes.Length) {
                    var (candidate,module)=probes[probeIndex];
                    cancellation.ThrowIfCancellationRequested();
                    if(candidate.Layout!="swsh" && module.Address+candidate.Offset+8>module.End){probeIndex++;continue;}
                    byte[] candidateSignature;
                    try {
                        candidateSignature=ReadGuest(module.Address,32);
                        uint mod=BinaryPrimitives.ReadUInt32LittleEndian(candidateSignature.AsSpan(4));
                        if(mod>0x10000000 || BinaryPrimitives.ReadUInt32LittleEndian(ReadGuest(module.Address+mod,4))!=0x30444F4D){probeIndex++;continue;}
                    }catch(GdbMemoryUnavailable){probeIndex++;continue;}
                    {
                        try {
                            SwitchPartyReader.Read(candidate,module.Address,info.Heap,ReadGuest);
                            matches.Add((candidate,module.Address,candidateSignature));
                        }catch(Exception e)when(e is GdbMemoryUnavailable or InvalidDataException or OverflowException){}
                    }
                    probeIndex++;
                }
                var found=matches.ToArray();probes=null;probeIndex=0;matches.Clear();
                if(found.Length!=1){Status=found.Length>1?"Plusieurs profils Switch correspondent. Relance le jeu.":"Équipe indisponible. Ouvre une partie avec une version de jeu prise en charge.";return null;}
                (profile,main,signature)=found[0];combat.Reset();
            }
            if(!ReadGuest(main,32).AsSpan().SequenceEqual(signature)) {
                ClearProfile();nextInfo=default;Status="Jeu Switch en cours de changement.";return null;
            }
            var field=SwitchPartyReader.Read(profile,main,info!.Heap,ReadGuest);
            var frame=SwordShieldBattleReader.Read(field,profile,info.Heap,ReadGuest);
            if(readFailure!=null)System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(readFailure).Throw();
            if(frame.InBattle) {
                var latest=SwitchPartyReader.Read(profile,main,info.Heap,ReadGuest);
                if(!PartyIdentity.SameOrder(field.Team,latest.Team))throw new InvalidDataException();
            }
            failures=0;Status="Lecture directe via GDB";
            return(profile.Name,combat.Apply(frame));
        }catch(GdbStopped e){stopped=true;Status=e.Message;return null;}
        catch(GdbBudgetExpired){Status="Lecture GDB retardée.";return null;}
        catch(GdbMemoryUnavailable){Status="Mémoire du jeu temporairement indisponible.";return null;}
        catch(InvalidDataException e) {
            if(locating){info=null;ClearProfile();nextConnect=DateTime.UtcNow.AddSeconds(3);Status=e.Message;}
            else Status="Mise à jour de l’équipe…";
            return null;
        }catch(OperationCanceledException)when(!cancellation.IsCancellationRequested) {
            Reset();Status="Connexion GDB expirée. Vérifie le port.";nextConnect=DateTime.UtcNow.AddSeconds(3);return null;
        }catch(Exception e)when(e is IOException or System.Net.Sockets.SocketException or Win32Exception or InvalidOperationException or ArgumentException or OverflowException) {
            Status=e is IOException?e.Message:"Connexion GDB impossible. Vérifie les droits et le port.";
            Reset();nextConnect=DateTime.UtcNow.AddSeconds(Math.Min(15,2*Math.Max(1,++failures)));return null;
        }finally{connection?.EndFrame();}
    }
    private byte[] ReadGuest(ulong address,int count){
        try{return connection?.Read(address,count)??throw new IOException("Connexion GDB fermée.");}
        catch(Exception e)when(e is IOException && e is not GdbMemoryUnavailable){readFailure=e;throw;}
    }
    private void ClearProfile(){profile=null;main=0;signature=null;probes=null;probeIndex=0;matches.Clear();nextProfile=default;combat.Reset();}
    private void Reset(){connection?.Dispose();connection=null;info=null;ClearProfile();nextInfo=default;}
    public void Dispose()=>Reset();
}
