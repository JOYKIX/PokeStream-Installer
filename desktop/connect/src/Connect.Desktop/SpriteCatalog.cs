using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text.Json;
using System.Windows.Media;
using System.Windows.Media.Imaging;
namespace PokeStream.Connect;

// Packaged assets only: rendering never performs network work or delays game reads.
internal static class SpriteCatalog {
    private sealed record Form(int PokemonId, string? FormSprite);
    private sealed record Catalog(Dictionary<string,Dictionary<string,string>> Items,
        Dictionary<string,string> ItemNames, Dictionary<string,string> ItemNamesEn, Dictionary<string,Form> Forms);
    private static Stream Resource(string suffix) {
        var assembly=Assembly.GetExecutingAssembly();
        return assembly.GetManifestResourceStream(assembly.GetManifestResourceNames().Single(n=>n.EndsWith(suffix)))!;
    }
    private static readonly Catalog Data=JsonSerializer.Deserialize<Catalog>(Resource("presentation.json"),new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
    private static readonly ZipArchive Archive=new(Resource("sprites.zip"),ZipArchiveMode.Read);
    private static readonly Dictionary<string,ZipArchiveEntry> Entries=Archive.Entries.ToDictionary(e=>e.FullName.Replace('\\','/'),StringComparer.Ordinal);
    private static readonly Dictionary<string,BitmapSource?> Cache=new(StringComparer.Ordinal);
    public static BitmapSource? Image(string path) {
        if(Cache.TryGetValue(path,out var image))return image;
        if(!Entries.TryGetValue(path,out var entry))return null;
        using var stream=entry.Open();using var memory=new MemoryStream();stream.CopyTo(memory);memory.Position=0;
        var bitmap=new BitmapImage();bitmap.BeginInit();bitmap.CacheOption=BitmapCacheOption.OnLoad;bitmap.StreamSource=memory;bitmap.EndInit();bitmap.Freeze();
        if(Cache.Count>=256)Cache.Clear();Cache[path]=bitmap;return bitmap;
    }
    public static ImageSource? Pokemon(PartyMember pokemon) {
        if(pokemon.Egg)return Image("pokemon/egg.png");
        Data.Forms.TryGetValue($"{pokemon.Generation}:{pokemon.Species}:{pokemon.Form??0}",out var form);
        string key=form?.FormSprite??(form?.PokemonId??pokemon.Species).ToString();
        string shiny=pokemon.Shiny?"shiny/":"";
        if(pokemon.Gender==1 && form?.FormSprite==null && Image("pokemon/"+shiny+"female/"+key+".png") is {} female)return female;
        return Image("pokemon/"+shiny+key+".png")??Image("pokemon/"+key+".png")
            ??Image("pokemon/"+shiny+pokemon.Species+".png")??Image("pokemon/"+pokemon.Species+".png");
    }
    public static (ImageSource? Image,string Name) Item(PartyMember pokemon) {
        if(pokemon.Egg || pokemon.HeldItem is not >0)return (null,"");
        string? slug=null;
        if(pokemon.Generation is {} generation && Data.Items.TryGetValue(generation.ToString(),out var items))
            items.TryGetValue(pokemon.HeldItem.Value.ToString(),out slug);
        return slug==null?(null,L.T("Objet tenu")):(Image("items/"+slug+".png"),(L.Language=="fr"?Data.ItemNames:Data.ItemNamesEn).GetValueOrDefault(slug,L.T("Objet tenu")));
    }
}
