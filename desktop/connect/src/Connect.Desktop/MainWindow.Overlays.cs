using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
namespace PokeStream.Connect;

public partial class MainWindow {
    private sealed record OverlayOption(string Id,string Name,string Game="",bool InUse=false) {
        public string DisplayName=>Id.Length==0?L.T(Name):Name+(InUse?L.T(" · Déjà utilisé"):"");
        public bool CanSelect=>Id.Length>0 && !InUse;
    }
    private OverlayOption[] overlayOptions=[];
    private bool refreshingOverlays,switchingOverlay,destinationUnknown,awaitingDestinationFrame;
    private long selectionRevision;
    private int? pendingJournalBaseline;
    private int linkVersion;

    private void RefreshOverlayChoices() {
        if(OverlayChoice==null)return;
        refreshingOverlays=true;
        try {
            var options=new List<OverlayOption>();
            if(sceneId==null)options.Add(new("",overlayOptions.Length==0?"Aucun overlay disponible":"Choisir un overlay"));
            options.AddRange(overlayOptions);
            if(sceneId!=null && options.All(o=>o.Id!=sceneId))
                options.Add(new(sceneId,AccountLabel.Text));
            var next=options.ToArray();
            if(OverlayChoice.ItemsSource is not OverlayOption[] previous || !previous.SequenceEqual(next))
                OverlayChoice.ItemsSource=next;
            OverlayChoice.SelectedValue=sceneId??"";
        } finally {refreshingOverlays=false;}
    }
    private void RefreshOverlays_Click(object sender,RoutedEventArgs e) {
        nextPairCheck=default;nextNetworkTick=default;
    }
    private void ForgetDestination() {
        linkVersion++;linked=false;sceneId=null;journal=null;journalScene=null;
        nuzlocke=false;pendingJournalBaseline=null;resetPending=false;forcedTotal=null;lastSent="";lastUpload=null;
        destinationUnknown=false;awaitingDestinationFrame=false;selectionRevision=0;overlayOptions=[];
        associationRejected=true;RefreshOverlayChoices();
        AccountLabel.Text=L.T("Compte non associé");AccountHint.Text=L.T("Associe cet appareil depuis ton navigateur.");
        PairButton.Content=L.T("Associer");
    }
    private async Task RefreshDestination() {
        using var request=Request(HttpMethod.Get);
        using var response=await http.SendAsync(request,lifetime.Token);
        if(response.StatusCode==HttpStatusCode.Unauthorized){ForgetDestination();return;}
        if(response.StatusCode==HttpStatusCode.Forbidden){RequireSubscription();return;}
        response.EnsureSuccessStatusCode();
        ApplyStatus(await response.Content.ReadFromJsonAsync<LinkStatus>(Json,lifetime.Token)??throw new JsonException());
    }
    private async void Overlay_Changed(object sender,SelectionChangedEventArgs e) {
        if(refreshingOverlays || switchingOverlay || destinationUnknown || resetPending || forcedTotal!=null || !linked ||
            OverlayChoice.SelectedItem is not OverlayOption {CanSelect:true} option || option.Id==sceneId)return;
        switchingOverlay=true;linkVersion++;
        // Finish the old request before selecting a new destination. Its response
        // is ignored by SyncLatest because the local link version changed.
        UpdatePresentation();
        string? notice=null;
        try {
            var pending=networkTick;
            if(pending!=null) {
                try {await pending;}
                catch(Exception error)when(error is HttpRequestException or TaskCanceledException or JsonException or IOException){}
            }
            lifetime.Token.ThrowIfCancellationRequested();
            using var request=Request(HttpMethod.Patch);
            request.Content=new StringContent(JsonSerializer.Serialize(new {sceneId=option.Id,selectionRevision},Json),Encoding.UTF8,"application/json");
            using var response=await http.SendAsync(request,lifetime.Token);
            if(response.StatusCode==HttpStatusCode.Unauthorized){ForgetDestination();return;}
            if(response.StatusCode==HttpStatusCode.Forbidden){RequireSubscription();return;}
            if(response.StatusCode==HttpStatusCode.Conflict) {
                var issue=await response.Content.ReadFromJsonAsync<SelectionError>(Json,lifetime.Token);
                notice=L.T(issue?.Error switch {
                    "scene_in_use"=>"Cet overlay est utilisé par un autre appareil.",
                    "scene_missing"=>"Cet overlay n’est plus disponible.",
                    _=>"La sélection a changé. Liste actualisée."
                });
                await RefreshDestination();
            } else {
                response.EnsureSuccessStatusCode();
                ApplyStatus(await response.Content.ReadFromJsonAsync<LinkStatus>(Json,lifetime.Token)??throw new JsonException());
                LogActivity(L.T("Overlay sélectionné : {0}",option.Name));
            }
        } catch(OperationCanceledException)when(lifetime.IsCancellationRequested){}
        catch(InvalidDataException){journalUnavailable=true;}
        catch(Exception error)when(error is HttpRequestException or TaskCanceledException or JsonException or IOException or UnauthorizedAccessException) {
            // A timeout may happen AFTER the server committed the switch.
            // Do not guess which overlay is active or send to the previous one.
            destinationUnknown=true;serverIssue=true;
            notice=L.T("Sélection à confirmer. Nouvelle tentative automatique.");
        } finally {
            switchingOverlay=false;nextPairCheck=default;nextNetworkTick=default;
            RefreshOverlayChoices();UpdatePresentation();
            if(notice!=null)AccountHint.Text=notice;
        }
    }
    private sealed record SelectionError(string? Error);
}
