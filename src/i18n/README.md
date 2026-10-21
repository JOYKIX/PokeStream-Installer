# Localization

English is the fallback. The saved cookie takes precedence over the first browser language (unsupported languages resolve to English). Routes and authentication callbacks keep their existing URLs.

UI copy lives in messages/en.json, fr.json, ja.json, es.json and de.json. Source phrases are stable message keys; user names, nicknames and overlay names must never be used as translation keys. Use useI18n() in client components and await getTranslations() in server components/routes. Parameterized messages use {name} and t(key, { name }).

To add a language, register its code in config.ts, its catalog in catalog.ts, and its label in localeNames (the selector is generated from locales), then add its vector flag to LanguageFlag. Missing translations fall back to English. Pokémon, item and form names use the local PokeAPI catalogs (scripts/sync-localized-game-data.mjs). Search supports localized names and hiragana/katakana. Nicknames are kept exactly as entered; eggs never show their species.

Connect maintains its own embedded catalogs in desktop/connect/src/Connect.Desktop/Localization. Add a catalog to L.Catalogs and a Settings language option. The preference is stored in preferences.json; auto uses the Windows UI language.
