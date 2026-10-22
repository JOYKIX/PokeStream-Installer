using System.Globalization;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Windows;

namespace PokeStream.Connect;

// Register a catalog here to add a language. English is the fallback for missing entries.
internal static class L {
    private static readonly Dictionary<string, Dictionary<string, string>> Catalogs = new() {
        ["en"] = Read("en"),
        ["fr"] = Read("fr"),
        ["ja"] = Read("ja"),
        ["es"] = Read("es"), ["de"] = Read("de"), ["pt-BR"] = Read("pt-BR"),
        ["it"] = Read("it"), ["ko"] = Read("ko"), ["zh-CN"] = Read("zh-CN"), ["zh-TW"] = Read("zh-TW")
    };

    private static readonly Dictionary<string, string> Originals = Catalogs["en"]
        .GroupBy(p => p.Value, StringComparer.Ordinal)
        .ToDictionary(g => g.Key, g => g.First().Key, StringComparer.Ordinal);

    private static readonly string SystemLanguage =
        CultureInfo.CurrentUICulture.Name;

    public static string Language { get; private set; } = "en";
    public static string Preference { get; private set; } = "auto";

    private static Dictionary<string, string> Read(string locale) {
        var assembly = Assembly.GetExecutingAssembly();

        using var stream = assembly
            .GetManifestResourceStream(
                assembly.GetManifestResourceNames()
                    .Single(n => n.EndsWith("Localization." + locale + ".json"))
            )!;

        return JsonSerializer.Deserialize<Dictionary<string, string>>(stream)!;
    }

    public static string GameName(string name) {
        int suffix = name.IndexOf(" (", StringComparison.Ordinal);

        return suffix < 0
            ? T(name)
            : T(name[..suffix]) + name[suffix..];
    }

    public static string Original(string text) =>
        Originals.GetValueOrDefault(text, text);

    public static string T(string key, params object[] args) {
        var text = Catalogs[Language]
            .GetValueOrDefault(
                key,
                Catalogs["en"].GetValueOrDefault(key, key)
            );

        return args.Length == 0
            ? text
            : string.Format(CultureInfo.CurrentCulture, text, args);
    }

    private static string Normalize(string tag) {
        var code=tag.ToLowerInvariant();
        if(code.StartsWith("pt"))return "pt-BR";
        if(code.StartsWith("zh"))return code.Contains("tw")||code.Contains("hk")||code.Contains("hant")?"zh-TW":"zh-CN";
        return code.Split('-')[0];
    }
    public static void Set(string? preference) {
        Preference =
            preference != null && Catalogs.ContainsKey(preference)
                ? preference
                : "auto";

        string detected =
            Preference == "auto"
                ? Normalize(SystemLanguage)
                : Preference;

        Language =
            Catalogs.ContainsKey(detected)
                ? detected
                : "en";

        var culture = CultureInfo.GetCultureInfo(Language switch {
            "fr" => "fr-FR",
            "ja" => "ja-JP",
            "es" => "es-ES", "de" => "de-DE", "pt-BR" => "pt-BR", "it" => "it-IT",
            "ko" => "ko-KR", "zh-CN" => "zh-CN", "zh-TW" => "zh-TW",
            _ => "en-US"
        });

        CultureInfo.CurrentUICulture = culture;
        CultureInfo.CurrentCulture = culture;

        foreach (string source in Catalogs["en"].Keys) {
            string id =
                "L" +
                Convert.ToHexString(
                    SHA1.HashData(Encoding.UTF8.GetBytes(source))
                )
                .ToLowerInvariant()[..12];

            Application.Current.Resources[id] = T(source);
        }
    }

    public static void Initialize() {
        string? preference = null;

        try {
            string file =
                Path.Combine(AppPaths.Data, "preferences.json");

            if (File.Exists(file)) {
                using var data =
                    JsonDocument.Parse(File.ReadAllText(file));

                if (
                    data.RootElement.TryGetProperty(
                        "language",
                        out var language
                    )
                )
                    preference = language.GetString();
            }
        }
        catch (Exception e)
            when (
                e is IOException
                or UnauthorizedAccessException
                or JsonException
            ) {
        }

        Set(preference);
    }
}