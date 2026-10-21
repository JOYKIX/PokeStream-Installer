using System.IO;
using System.Reflection;
using System.Security.Cryptography;
namespace PokeStream.Connect;
internal static class SaveReaderTool {
    public static string Extract(string folder) {
        var asm=Assembly.GetExecutingAssembly();var name=asm.GetManifestResourceNames().SingleOrDefault(n=>n.EndsWith("PokeStream.SaveReader.exe"));
        if(name==null)throw new IOException(L.T("Lecteur de sauvegardes absent. Réinstalle Connect."));
        using var stream=asm.GetManifestResourceStream(name)!;using var data=new MemoryStream();stream.CopyTo(data);byte[] bytes=data.ToArray();
        string digest=Convert.ToHexString(SHA256.HashData(bytes));string directory=Path.Combine(folder,"tools",digest[..16]);Directory.CreateDirectory(directory);
        string target=Path.Combine(directory,"PokeStream.SaveReader.exe");
        if(File.Exists(target)){using var file=File.OpenRead(target);if(Convert.ToHexString(SHA256.HashData(file))==digest)return target;}
        string temp=target+".tmp";File.WriteAllBytes(temp,bytes);File.Move(temp,target,true);return target;
    }
}
