using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shell;
namespace PokeStream.Connect;

public partial class MainWindow {
    private Window Dialog(string title,FrameworkElement content,double width=460) {
        var close=new Button{Content="×",Width=34,Height=32,Padding=new Thickness(0),Style=(Style)FindResource("QuietButton")};
        WindowChrome.SetIsHitTestVisibleInChrome(close,true);
        var heading=new DockPanel{Margin=new Thickness(18,8,10,8)};
        DockPanel.SetDock(close,Dock.Right);heading.Children.Add(close);heading.Children.Add(new TextBlock{Text=title,FontWeight=FontWeights.SemiBold,FontSize=15,VerticalAlignment=VerticalAlignment.Center});
        var layout=new Grid();layout.RowDefinitions.Add(new RowDefinition{Height=new GridLength(48)});layout.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto});
        layout.Children.Add(new Border{Child=heading,BorderBrush=(Brush)FindResource("LineBrush"),BorderThickness=new Thickness(0,0,0,1)});
        content.Margin=new Thickness(22);Grid.SetRow(content,1);layout.Children.Add(content);
        var dialog=new Window{Owner=this,Title=title,Width=width,SizeToContent=SizeToContent.Height,ResizeMode=ResizeMode.NoResize,WindowStyle=WindowStyle.None,Background=(Brush)FindResource("PanelBrush"),Foreground=(Brush)FindResource("TextBrush"),WindowStartupLocation=WindowStartupLocation.CenterOwner,
            Content=new Border{Child=layout,BorderBrush=(Brush)FindResource("LineBrush"),BorderThickness=new Thickness(1)}};
        WindowChrome.SetWindowChrome(dialog,new WindowChrome{CaptionHeight=48,ResizeBorderThickness=new Thickness(0),GlassFrameThickness=new Thickness(0),UseAeroCaptionButtons=false});
        close.Click+=(_,_)=>dialog.Close();dialog.PreviewKeyDown+=(_,e)=>{if(e.Key==Key.Escape){dialog.Close();e.Handled=true;}};
        return dialog;
    }
    private void ShowNotice(string title,string message) {
        var panel=new StackPanel();panel.Children.Add(new TextBlock{Text=message,TextWrapping=TextWrapping.Wrap});
        var done=new Button{Content=L.T("Fermer"),HorizontalAlignment=HorizontalAlignment.Right,Margin=new Thickness(0,20,0,0),IsDefault=true};panel.Children.Add(done);
        var dialog=Dialog(title,panel);done.Click+=(_,_)=>dialog.Close();dialog.ShowDialog();
    }
    private bool ConfirmReset() {
        var panel=new StackPanel();panel.Children.Add(new TextBlock{Text=L.T("Remettre le compteur à zéro et effacer les Pokémon déjà comptés ?"),TextWrapping=TextWrapping.Wrap});
        panel.Children.Add(new TextBlock{Text=L.T("Le suivi sera mis en pause. Les Pokémon encore K.O. seront recomptés à la reprise."),Foreground=Muted,FontSize=12,TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,10,0,20)});
        var actions=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right};
        var cancel=new Button{Content=L.T("Annuler"),IsCancel=true,Margin=new Thickness(0,0,8,0)};
        var confirm=new Button{Content=L.T("Réinitialiser"),Style=(Style)FindResource("PrimaryButton")};actions.Children.Add(cancel);actions.Children.Add(confirm);panel.Children.Add(actions);
        var dialog=Dialog(L.T("Réinitialiser le suivi"),panel);confirm.Click+=(_,_)=>dialog.DialogResult=true;
        return dialog.ShowDialog()==true;
    }
    private void EditDeathCount() {
        var targetJournal=journal;
        var panel=new StackPanel();panel.Children.Add(new TextBlock{Text=L.T("Total des morts"),FontWeight=FontWeights.SemiBold});
        var input=new TextBox{Text=journal!.Deaths.ToString(),Margin=new Thickness(0,10,0,8),MaxLength=4,FontSize=22};panel.Children.Add(input);
        var hint=new TextBlock{Text=L.T("De 0 à 9999. L’historique des Pokémon comptés est conservé."),Foreground=Muted,FontSize=12,TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,0,0,18)};panel.Children.Add(hint);
        var actions=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right};var cancel=new Button{Content=L.T("Annuler"),IsCancel=true,Margin=new Thickness(0,0,8,0)};var save=new Button{Content=L.T("Enregistrer"),Style=(Style)FindResource("PrimaryButton"),IsDefault=true};actions.Children.Add(cancel);actions.Children.Add(save);panel.Children.Add(actions);
        var dialog=Dialog(L.T("Corriger le compteur"),panel);
        save.Click+=(_,_)=>{if(!ReferenceEquals(targetJournal,journal)){dialog.Close();return;}if(int.TryParse(input.Text,out int total)&&total is >=0 and <=9999){forcedTotal=total;dialog.Close();LogActivity(L.T("Correction du compteur demandée"));}else{hint.Text=L.T("Entre un nombre de 0 à 9999.");hint.Foreground=Red;input.Focus();}};
        dialog.Loaded+=(_,_)=>{input.Focus();input.SelectAll();};dialog.ShowDialog();
    }
    private void ShowLicenses() {
        var text=new TextBox{Text=Resource("THIRD-PARTY-NOTICES.md"),IsReadOnly=true,TextWrapping=TextWrapping.Wrap,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,Height=450};
        Dialog(L.T("Licences"),text,720).ShowDialog();
    }
}
