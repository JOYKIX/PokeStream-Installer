// Compatibility keys are intentionally retained for existing installations.
export const legacySessionCookie = "pokeoverlay-session";
export const legacyLocaleCookie = "pokeoverlay-language";
export function readLocalPreference(key: string): string | null {
  const current = localStorage.getItem(key);
  if (current !== null) return current;
  const previous = key.replace(/^pokestream-/, "pokeoverlay-");
  if (previous === key) return null;
  const value = localStorage.getItem(previous);
  if (value !== null) { localStorage.setItem(key, value); localStorage.removeItem(previous); }
  return value;
}
