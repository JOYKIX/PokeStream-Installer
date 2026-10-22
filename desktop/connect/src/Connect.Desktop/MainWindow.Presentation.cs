using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Win32;
namespace PokeStream.Connect;

public partial class MainWindow {
    private sealed record Preferences(string? Emulator=null,bool AlwaysOnTop=false,double Width=1180,double Height=880,bool Maximized=false,string Language="auto",int RyujinxGdbPort=0,int CitronGdbPort=0);
    private sealed record ActivityEntry(string Time,string Source) { public string Message=>L.T(Source); }
    private sealed record SlotView(string Slot,string Name,string Detail,string Gender,string GenderLabel,string State,Brush StateBrush,
        ImageSource? Sprite,ImageSource? ItemSprite,string ItemName,Visibility ItemVisibility,double SpriteOpacity,
        double HpPercent,string HealthText,Brush HealthBrush,Visibility HealthVisibility,Brush Surface,Brush Outline,string Summary);
    private static readonly Brush Muted=Paint("#959CAB"),Green=Paint("#65C6A0"),Amber=Paint("#DDB16B"),Red=Paint("#F37888");
    private static readonly Brush CardSurface=Paint("#16191F"),EmptySurface=Paint("#101217"),CardLine=Paint("#2D323D"),KoLine=Paint("#553039");
    private readonly ObservableCollection<ActivityEntry> activity=[];
    private readonly TeamSlot[] slots=new TeamSlot[6];
    private readonly PartyMember?[] shownMembers=new PartyMember?[6];
    private Preferences preferences=new();
    private bool preferencesReady,serverIssue,journalUnavailable,associationRejected,readIssue;
    private DateTimeOffset? lastUpload;
    private string presentationState="",lastLoggedGame="";
    private static Brush Paint(string hex) { var brush=(SolidColorBrush)new BrushConverter().ConvertFromString(hex)!;brush.Freeze();return brush; }
    private void InitializePresentation() {
        for(int i=0;i<slots.Length;i++){slots[i]=new TeamSlot();TeamGrid.Children.Add(slots[i]);}
        ActivityList.ItemsSource=activity;LogActivity(L.T("Connect ouvert"));
        try {var path=Path.Combine(Folder,"preferences.json");if(File.Exists(path))preferences=JsonSerializer.Deserialize<Preferences>(File.ReadAllText(path),Json)??new();}
        catch(Exception e)when(e is IOException or UnauthorizedAccessException or JsonException){}
        var work=SystemParameters.WorkArea;
        Width=Math.Clamp(double.IsFinite(preferences.Width)?preferences.Width:1180,MinWidth,Math.Max(MinWidth,work.Width));
        Height=Math.Clamp(double.IsFinite(preferences.Height)?preferences.Height:880,MinHeight,Math.Max(MinHeight,work.Height));
        TopmostToggle.IsChecked=preferences.AlwaysOnTop;Topmost=preferences.AlwaysOnTop;
        if(preferences.Maximized)WindowState=WindowState.Maximized;
        LanguageChoice.SelectedValue=L.Preference;
        UpdateLanguageHint();
        preferences=preferences with {RyujinxGdbPort=ValidPort(preferences.RyujinxGdbPort),CitronGdbPort=ValidPort(preferences.CitronGdbPort)};
        RyujinxPort.Text=PortText(preferences.RyujinxGdbPort);CitronPort.Text=PortText(preferences.CitronGdbPort);
        preferencesReady=true;UpdatePreferenceLabels();
    }
    private void Language_Changed(object sender,SelectionChangedEventArgs e) {
        if(!preferencesReady || LanguageChoice.SelectedValue is not string language)return;
        preferences=preferences with {Language=language};L.Set(language);SavePreferences();UpdateLanguageHint();
        foreach(var slot in slots)slot.DataContext=null;
        ShowTeam(displayedFrame);UpdatePresentation();ActivityList.Items.Refresh();SaveChoice.Items.Refresh();RefreshOverlayChoices();
        if(linked){AccountHint.Text=L.T(sceneId==null?"Choisis un overlay pour synchroniser le jeu.":"Compte associé");PairButton.Content=L.T("Gérer");}
        else {AccountLabel.Text=L.T("Aucun overlay associé");AccountHint.Text=L.T("Connexion depuis le navigateur.");PairButton.Content=L.T(subscriptionRequired?"Abonnement":"Associer");}
        if(latestDetected==null){GameLabel.Text=L.T("Aucun jeu détecté");GameStatus.Text=L.T("Lance une partie dans ton émulateur.");}
    }
    private void UpdateLanguageHint() {
        string label=L.Language switch {"fr"=>"Français", "ja"=>"日本語", "es"=>"Español", "de"=>"Deutsch", "pt-BR"=>"Português (Brasil)", "it"=>"Italiano", "ko"=>"한국어", "zh-CN"=>"简体中文", "zh-TW"=>"繁體中文", _=>"English"};
        LanguageChoice.ToolTip=L.Preference=="auto"?L.T("Automatique (système)")+" · "+label:label;
    }
    private bool SavePreferences() {
        if(!preferencesReady)return false;
        preferences=preferences with {AlwaysOnTop=Topmost,Width=WindowState==WindowState.Normal?Width:RestoreBounds.Width,Height=WindowState==WindowState.Normal?Height:RestoreBounds.Height,Maximized=WindowState==WindowState.Maximized};
        try {File.WriteAllText(Path.Combine(Folder,"preferences.json"),JsonSerializer.Serialize(preferences,Json));return true;}
        catch(Exception e)when(e is IOException or UnauthorizedAccessException){LogActivity(L.T("Préférences non enregistrées"));return false;}
    }
    private static int ValidPort(int value)=>value is >=1 and <=65535?value:0;
    private static string PortText(int value)=>value==0?"":value.ToString(System.Globalization.CultureInfo.InvariantCulture);
    private static bool ParsePort(string text,out int port) {
        port=0;text=text.Trim();return text.Length==0 || (text.All(char.IsAsciiDigit)&&int.TryParse(text,out port)&&ValidPort(port)!=0);
    }
    private void ApplyGdbPorts_Click(object sender,RoutedEventArgs e) {
        if(!ParsePort(RyujinxPort.Text,out int ryujinx)||!ParsePort(CitronPort.Text,out int citron)){
            GdbPortStatus.Text=L.T("Indique un port entre 1 et 65535.");return;
        }
        var previous=preferences;preferences=preferences with {RyujinxGdbPort=ryujinx,CitronGdbPort=citron};
        if(!SavePreferences()){preferences=previous;GdbPortStatus.Text=L.T("Préférences non enregistrées");return;}
        selectionVersion++;switchReaderResetRequested=true;
        GdbPortStatus.Text=L.T("Ports enregistrés. Reconnexion demandée.");LogActivity(GdbPortStatus.Text);
    }
    private void UpdatePreferenceLabels() {
        EmulatorPathLabel.Text=preferences.Emulator==null?L.T("Aucun émulateur enregistré"):Path.GetFileNameWithoutExtension(preferences.Emulator);
        SavePathLabel.Text=savePath==null?L.T("Automatique si disponible"):Path.GetFileName(savePath);
    }
    private void Navigation_Changed(object sender,RoutedEventArgs e) {
        if(SessionPage==null || SettingsPage==null || HelpPage==null)return;
        string page=(sender as FrameworkElement)?.Tag as string??"session";
        SessionPage.Visibility=page=="session"?Visibility.Visible:Visibility.Collapsed;
        SettingsPage.Visibility=page=="settings"?Visibility.Visible:Visibility.Collapsed;
        HelpPage.Visibility=page=="help"?Visibility.Visible:Visibility.Collapsed;
    }
    private void Settings_Click(object sender,RoutedEventArgs e)=>SettingsNav.IsChecked=true;
    private void Minimize_Click(object sender,RoutedEventArgs e)=>SystemCommands.MinimizeWindow(this);
    private void Maximize_Click(object sender,RoutedEventArgs e) {if(WindowState==WindowState.Maximized)SystemCommands.RestoreWindow(this);else SystemCommands.MaximizeWindow(this);}
    private void Close_Click(object sender,RoutedEventArgs e)=>Close();
    private void Window_StateChanged(object? sender,EventArgs e) {
        if(WindowFrame==null)return;
        // WindowChrome retains native resizing/snap; keep content inside the resize frame when maximized.
        WindowFrame.Margin=WindowState==WindowState.Maximized?new Thickness(SystemParameters.WindowResizeBorderThickness.Left):new Thickness(0);
        MaximizeIcon.Data=Geometry.Parse(WindowState==WindowState.Maximized?"M 3,3 V 1 H 11 V 9 H 9 M 1,3 H 9 V 11 H 1 Z":"M 1,1 H 10 V 10 H 1 Z");
    }
    private void Topmost_Changed(object sender,RoutedEventArgs e) {if(!preferencesReady)return;Topmost=TopmostToggle.IsChecked==true;SavePreferences();}
    private void GameAction_Click(object sender,RoutedEventArgs e) {if(selected==null)LaunchEmulator();else SettingsNav.IsChecked=true;}
    private void ChooseEmulator_Click(object sender,RoutedEventArgs e)=>ChooseEmulator();
    private bool ChooseEmulator() {
        var dialog=new OpenFileDialog{Title=L.T("Choisir l’émulateur"),Filter=L.T("Application Windows (*.exe)|*.exe"),CheckFileExists=true};
        if(dialog.ShowDialog()!=true)return false;
        if(ProcessMemory.LabelFor(Path.GetFileNameWithoutExtension(dialog.FileName))==null){ShowNotice(L.T("Émulateur non reconnu"),L.T("Choisis melonDS, DeSmuME, Citra, Azahar, mGBA, Ryujinx ou Citron."));return false;}
        preferences=preferences with {Emulator=dialog.FileName};SavePreferences();UpdatePreferenceLabels();return true;
    }
    private void LaunchEmulator() {
        if(preferences.Emulator==null || !File.Exists(preferences.Emulator))if(!ChooseEmulator())return;
        try {Process.Start(new ProcessStartInfo(preferences.Emulator!){UseShellExecute=true,WorkingDirectory=Path.GetDirectoryName(preferences.Emulator)});SessionNav.IsChecked=true;LogActivity(L.T("Émulateur ouvert"));}
        catch(Exception e)when(e is Win32Exception or IOException or UnauthorizedAccessException){ShowNotice(L.T("Ouverture impossible"),L.T("Vérifie l’émulateur sélectionné dans Réglages."));}
    }
    private void Compatibility_Click(object sender,RoutedEventArgs e)=>OpenWebsite(Site+"/connect#compatibilite");
    private void OpenWebsite(string url) {try{Browse(url);}catch(Win32Exception){ShowNotice(L.T("Navigateur indisponible"),L.T("Ouvre pokestream.vercel.app dans ton navigateur."));}}
    private void LogActivity(string text) {if(activity.FirstOrDefault()?.Message==text)return;activity.Insert(0,new(DateTime.Now.ToString("HH:mm:ss"),L.Original(text)));while(activity.Count>30)activity.RemoveAt(activity.Count-1);}
    private void CopyDiagnostics_Click(object sender,RoutedEventArgs e) {
        // No credentials, paths, usernames, Pokémon identifiers or party contents in exported diagnostics.
        string text=L.T("PokeStream Connect · 1.0.2\n")+L.T("Émulateur : ")+(selected?.Label??L.T("aucun"))+L.T("\nLecture : ")+ReadingState.Text+L.T("\nSite : ")+SyncLabel.Text+L.T("\nDernier envoi : ")+LastSyncLabel.Text+"\n"+GameStatus.Text+"\n\n"+string.Join("\n",activity.Select(a=>a.Time+"  "+a.Message));
        try {Clipboard.SetText(text);CopyDiagnosticsButton.Content=L.T("Copié");}
        catch(System.Runtime.InteropServices.ExternalException){CopyDiagnosticsButton.Content=L.T("Réessayer");}
    }
    private void UpdatePresentation() {
        UpdatePreferenceLabels();
        AccountState.Text=subscriptionRequired?L.T("Accès requis"):linked?L.T("Associé"):L.T("À associer");
        AccountState.Foreground=linked?Green:subscriptionRequired?Amber:Muted;
        ReadingState.Text=readIssue?L.T("Lecture retardée"):latestDetected?.Source switch {ReadingSource.Live=>latestDetected.Frame.InBattle?L.T("Combat"):L.T("Direct"),ReadingSource.Save=>L.T("Sauvegarde"),ReadingSource.Updating=>L.T("Direct"),ReadingSource.Retained=>L.T("Dernière lecture"),_=>L.T("En attente")};
        ReadingState.Foreground=latestDetected?.Source is ReadingSource.Live or ReadingSource.Updating?Green:Muted;
        TeamState.Text=latestDetected?.Source switch {ReadingSource.Live=>latestDetected.Frame.InBattle?L.T("Combat en cours"):L.T("Lecture directe"),ReadingSource.Save=>L.T("Sauvegarde · ")+latestDetected.ObservedAt.ToLocalTime().ToString("HH:mm"),ReadingSource.Updating=>L.T("Mise à jour de l’équipe"),ReadingSource.Retained=>L.T("Dernière équipe conservée"),_=>L.T("En attente d’une lecture")};
        LastSyncLabel.Text=lastUpload?.ToLocalTime().ToString("HH:mm:ss")??"—";
        NuzlockeValue.Text=journal!=null&&nuzlocke?journal.Deaths.ToString():"—";
        NuzlockeStatus.Text=journalUnavailable?L.T("Historique indisponible"):!linked?L.T("Aucun overlay associé"):!nuzlocke?L.T("Désactivé"):resetPending?L.T("Envoi en cours"):latestDetected?.Frame.Team.All(p=>p.Egg||p.Pid!=null)==true?L.T("Suivi automatique"):L.T("Compteur manuel");
        BadgeValue.Text=(latestDetected?.Frame ?? displayedFrame)?.Badges is {} badges?badges.Distinct().Count().ToString():"—";
        BadgeStatus.Text=latestDetected?.Frame.Badges is not null?latestDetected.Frame.BadgesFromSave?L.T("Depuis la sauvegarde"):latestDetected.Source==ReadingSource.Retained?L.T("Dernière lecture"):L.T("Lecture du jeu"):latestDetected==null?L.T("En attente du jeu"):L.T("Lecture indisponible");
        PauseButton.IsEnabled=linked && sceneId!=null && !switchingOverlay && !destinationUnknown && !resetPending;
        OverlayChoice.Visibility=linked?Visibility.Visible:Visibility.Collapsed;
        AccountLabel.Visibility=linked?Visibility.Collapsed:Visibility.Visible;
        OverlayChoice.IsEnabled=linked && !switchingOverlay && !destinationUnknown && !resetPending && forcedTotal==null && overlayOptions.Length>0;
        RefreshOverlaysButton.Visibility=linked?Visibility.Visible:Visibility.Collapsed;
        RefreshOverlaysButton.IsEnabled=!switchingOverlay;
        CreateOverlayButton.Visibility=linked && overlayOptions.Length==0?Visibility.Visible:Visibility.Collapsed;
        PauseButton.Content=paused?L.T("Reprendre"):L.T("Mettre en pause");
        (string key,string title,string hint,Brush colour) state;
        if(switchingOverlay)state=("switching",L.T("Changement d’overlay…"),L.T("Envois suspendus pendant le changement."),Amber);
        else if(destinationUnknown)state=("selection-unknown",L.T("Sélection à confirmer"),L.T("Nouvelle tentative automatique."),Amber);
        else if(journalUnavailable)state=("journal",L.T("Suivi interrompu"),L.T("Historique Nuzlocke illisible. Consulte l’aide."),Red);
        else if(subscriptionRequired)state=("access",L.T("Accès Connect requis"),L.T("Vérifie ton accès sur le site."),Amber);
        else if(!linked)state=pairingUntil>DateTimeOffset.UtcNow?("pairing",L.T("Association en cours"),L.T("Termine l’association dans le navigateur."),Amber):credential==null||associationRejected?("unlinked",L.T("Association requise"),L.T("Associe ton compte pour commencer."),Muted):serverIssue?("offline",L.T("Site indisponible"),L.T("Nouvelle tentative automatique."),Amber):("connecting",L.T("Connexion au site…"),L.T("Vérification de l’association."),Muted);
        else if(sceneId==null)state=("choose-overlay",L.T("Choisir un overlay"),L.T("Sélectionne la destination dans la liste."),Muted);
        else if(paused)state=("paused",L.T("Synchronisation en pause"),L.T("L’overlay conserve la dernière équipe."),Amber);
        else if(serverIssue)state=("offline",L.T("Envoi différé"),L.T("Nouvelle tentative automatique."),Amber);
        else if(readIssue)state=("read-error",L.T("Lecture en attente"),L.T("Vérifie l’émulateur. L’équipe est conservée."),Amber);
        else if(latestDetected==null)state=("waiting",L.T("En attente du jeu"),L.T("Ouvre une partie dans ton émulateur."),Muted);
        else if(latestDetected.Source==ReadingSource.Retained)state=("retained",L.T("Lecture en attente"),L.T("La dernière équipe est conservée."),Amber);
        else if(latestDetected.Source==ReadingSource.Updating)state=("updating",L.T("Liaison maintenue"),L.T("Changement d’équipe en cours."),Green);
        else if(lastUpload==null)state=("sending",L.T("Premier envoi…"),L.T("L’équipe est prête à être synchronisée."),Muted);
        else if(latestDetected.Source==ReadingSource.Save)state=("save",L.T("Sauvegarde synchronisée"),L.T("Sauvegarde en jeu pour actualiser l’équipe."),Green);
        else state=("live",L.T("Synchronisation active"),latestDetected.Frame.InBattle?L.T("Combat en cours."):L.T("Équipe transmise au studio."),Green);
        SyncLabel.Text=state.title;HintLabel.Text=state.hint;SyncDot.Fill=state.colour;
        GameActionButton.Content=selected==null?L.T("Ouvrir"):L.T("Réglages");
        if(presentationState!=state.key){presentationState=state.key;LogActivity(state.title);CopyDiagnosticsButton.Content=L.T("Copier le diagnostic");}
        string currentGame=selected?.Label+"/"+gameKey;
        if(currentGame!=lastLoggedGame && selected!=null){lastLoggedGame=currentGame;LogActivity(selected.Label+" · "+(gameKey==null?L.T("recherche du jeu"):L.T("jeu détecté")));}
    }
    private PartyFrame? displayedFrame;
    private void ShowTeam(PartyFrame? frame) {
        displayedFrame=frame;
        TeamCount.Text=(frame?.Team.Length??0)+" / 6";
        for(int i=0;i<6;i++) {
            var p=frame?.Team.ElementAtOrDefault(i);
            if(slots[i].DataContext!=null && Equals(p,shownMembers[i]))continue;
            shownMembers[i]=p;
            string name=p==null?L.T("Emplacement libre"):p.Egg?L.T("Œuf"):string.IsNullOrWhiteSpace(p.Nickname)?(L.Language=="fr"?names:englishNames).GetValueOrDefault(p.Species.ToString(),"Pokémon"):p.Nickname;
            bool hasHp=p is {Egg:false,MaxHp:>0};double ratio=hasHp?Math.Clamp((double)p!.Hp/p.MaxHp,0,1):0;
            var item=p==null?(Image:(ImageSource?)null,Name:""):SpriteCatalog.Item(p);
            string health=hasHp?$"{p!.Hp} / {p.MaxHp}":"—";
            string gender=p is {Egg:false}?p.Gender==0?"M":p.Gender==1?"F":"":"";
            string detail=p==null?"":p.Egg?L.T("À éclore"):L.T("Niv. ")+p.Level;
            string state=p is {Egg:false,Hp:0}?"K.O.":p is {Egg:false,Shiny:true}?"✦":"";
            slots[i].DataContext=new SlotView((i+1).ToString("00"),name,detail,gender,gender=="M"?L.T("Mâle"):gender=="F"?L.T("Femelle"):"",state,state=="K.O."?Red:Amber,
                p==null?null:SpriteCatalog.Pokemon(p),item.Image,item.Name,item.Image==null?Visibility.Collapsed:Visibility.Visible,
                p is {Egg:false,Hp:0}?0.38:1,ratio*100,health,ratio<=.2?Red:ratio<=.5?Amber:Green,
                hasHp?Visibility.Visible:Visibility.Hidden,p==null?EmptySurface:CardSurface,p is {Egg:false,Hp:0}?KoLine:CardLine,
                L.T("Emplacement {0} · {1} · {2}",i+1,name,detail)+(hasHp?L.T(" · PV {0}",health):""));
        }
    }
}
