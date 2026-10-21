using System.Buffers.Binary;
using System.ComponentModel;
namespace PokeStream.Connect;

// Locate through Citron's own debugger, then read only the necessary native
// pages. Keep one connection/mapping while the selected game remains alive.
public sealed class CitronReader(EmulatorProcess target):IDisposable {
    private readonly ProcessMemory memory=new(target);
    private readonly CombatReadingPolicy combat=new();
    private CitronGdbConnection? connection;
    private CitronGdbConnection.Location? location;
    private SwitchProfile? profile;
    private byte[]? signature;
    private DateTime nextConnection,nextMetadata,nextProfile,firstMemoryFailure;
    private int failures;
    public string Status { get; private set; }="Recherche du jeu Switch…";
    public (string Name,PartyFrame Frame)? Read(CancellationToken cancellation) {
        cancellation.ThrowIfCancellationRequested();
        if(DateTime.UtcNow<nextConnection)return null;
        bool locating=false;
        try {
            if(!ProcessMemory.IsRunning(target))throw new IOException("Émulateur fermé.");
            connection??=new(target,cancellation);
            if(location==null || DateTime.UtcNow>=nextMetadata) {
                locating=true;
                var current=connection.Locate();locating=false;
                if(current!=location) {
                    location=current;profile=null;signature=null;combat.Reset();nextProfile=default;
                }
                nextMetadata=DateTime.UtcNow.AddSeconds(5);
            }
            if(profile==null) {
                if(DateTime.UtcNow<nextProfile)return null;
                nextProfile=DateTime.UtcNow.AddSeconds(3);
                // Version families sharing one party layout are one candidate,
                // not ambiguous "matches". Checksums and ordered identities must
                // pass twice before accepting any known layout.
                var candidates=SwitchPartyReader.Profiles.Where(p=>p.TitleId==location!.TitleId)
                    .GroupBy(p=>(p.Layout,p.Offset)).Select(g=>g.First()).ToArray();
                if(candidates.Length==0){Status="Jeu Switch non pris en charge en direct.";return null;}
                var found=new List<SwitchProfile>();
                foreach(var candidate in candidates) {
                    cancellation.ThrowIfCancellationRequested();
                    try{SwitchPartyReader.Read(candidate,location!.Main,location.Heap,ReadGuest);found.Add(candidate);}
                    catch(Exception e)when(e is IOException or InvalidDataException or OverflowException){}
                }
                if(found.Count!=1){Status="En attente d’une équipe Switch compatible.";return null;}
                var candidateSignature=ReadGuest(location!.Main,32);
                uint mod=BinaryPrimitives.ReadUInt32LittleEndian(candidateSignature.AsSpan(4));
                if(mod>0x10000000 || BinaryPrimitives.ReadUInt32LittleEndian(ReadGuest(location.Main+mod,4))!=0x30444F4D)
                    throw new IOException("Informations mémoire Citron indisponibles.");
                profile=found[0];signature=candidateSignature;combat.Reset();
            }
            if(!ReadGuest(location!.Main,32).AsSpan().SequenceEqual(signature)) {
                profile=null;signature=null;nextMetadata=default;nextProfile=default;combat.Reset();
                throw new InvalidDataException("Jeu Switch en cours de changement.");
            }
            var field=SwitchPartyReader.Read(profile,location.Main,location.Heap,ReadGuest);
            var frame=SwordShieldBattleReader.Read(field,profile,location.Heap,ReadGuest);
            if(frame.InBattle) {
                var latest=SwitchPartyReader.Read(profile,location.Main,location.Heap,ReadGuest);
                if(!PartyIdentity.SameOrder(field.Team,latest.Team))throw new InvalidDataException();
            }
            failures=0;firstMemoryFailure=default;Status="Lecture directe";
            return(profile.Name,combat.Apply(frame));
        }catch(InvalidDataException e) {
            // Menus, encrypted record updates and party swaps never detach a
            // healthy session or trigger a fresh search through every profile.
            Status=e.Message=="Active Fastmem dans Citron, puis relance le jeu."?e.Message:"Mise à jour de l’équipe…";
            if(locating){location=null;profile=null;signature=null;combat.Reset();nextMetadata=DateTime.UtcNow.AddSeconds(5);}
            if(location==null)nextConnection=DateTime.UtcNow.AddSeconds(5);
            failures=0;firstMemoryFailure=default;return null;
        }catch(OperationCanceledException)when(!cancellation.IsCancellationRequested) {
            Reset();Status="Citron ne répond pas.";nextConnection=DateTime.UtcNow.AddSeconds(5);return null;
        }catch(Exception e)when(e is IOException or System.Net.Sockets.SocketException or Win32Exception or InvalidOperationException or ArgumentException or OverflowException) {
            Status=e is IOException?e.Message:"Lecture Citron retardée.";
            if(firstMemoryFailure==default)firstMemoryFailure=DateTime.UtcNow;
            if(locating || location==null || ++failures>=3 && DateTime.UtcNow-firstMemoryFailure>=TimeSpan.FromSeconds(15)) {
                Reset();nextConnection=DateTime.UtcNow.AddSeconds(5);
            }
            return null;
        }
    }
    private byte[] ReadGuest(ulong address,int count) {
        var map=location??throw new IOException();
        if(address<0x10000 || count is <1 or >4096 || address>=map.Size || (ulong)count>map.Size-address)throw new IOException("Mémoire indisponible.");
        return memory.Read(checked(map.Native+address),count);
    }
    private void Reset(){
        connection?.Dispose();connection=null;location=null;profile=null;signature=null;
        nextMetadata=default;nextProfile=default;firstMemoryFailure=default;combat.Reset();failures=0;
    }
    public void Dispose(){Reset();memory.Dispose();}
}
