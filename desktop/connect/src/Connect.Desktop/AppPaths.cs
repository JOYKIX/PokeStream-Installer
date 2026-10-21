using System.IO;
namespace PokeStream.Connect;

internal static class AppPaths {
    public static readonly string Data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PokeStream Connect");
    // Compatibility only: preserve the pairing, preferences and Nuzlocke journal.
    public const string LegacyMutex = @"Local\PokeOverlay.Connect.Desktop";
    public static void Migrate() {
        string previous = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PokeOverlay Connect");
        Directory.CreateDirectory(Data);
        string marker = Path.Combine(Data, ".settings-migrated");
        if (File.Exists(marker)) return;
        if (Directory.Exists(previous) && (File.GetAttributes(previous) & FileAttributes.ReparsePoint) == 0) {
            foreach (string name in new[] { "account.bin", "preferences.json", "save-paths.json" }) {
                string source = Path.Combine(previous, name), target = Path.Combine(Data, name);
                if (File.Exists(source) && !File.Exists(target) && (File.GetAttributes(source) & FileAttributes.ReparsePoint) == 0) File.Copy(source, target);
            }
            string journals = Path.Combine(previous, "nuzlocke");
            if (Directory.Exists(journals) && (File.GetAttributes(journals) & FileAttributes.ReparsePoint) == 0) {
                var options = new EnumerationOptions { RecurseSubdirectories = true, AttributesToSkip = FileAttributes.ReparsePoint, IgnoreInaccessible = false };
                foreach (string file in Directory.EnumerateFiles(journals, "*", options)) {
                    string target = Path.Combine(Data, "nuzlocke", Path.GetRelativePath(journals, file));
                    Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                    if (!File.Exists(target)) File.Copy(file, target);
                }
            }
        }
        File.WriteAllText(marker, "0.3.8");
    }
}
