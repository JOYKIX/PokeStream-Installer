import type { SceneData } from "@/lib/model";
import type { CustomTheme } from "./schema";
export function resolveCustomTheme(data: SceneData, themes: CustomTheme[]): SceneData {
  if (data.style.theme !== "custom") return data;
  const theme = themes.find((t) => t.id === data.style.customThemeId);
  return { ...data, style: { ...data.style, theme: theme ? "custom" : "carbon", customTheme: theme?.config, accent: theme ? (data.style.customAccent ?? theme.config.accent) : data.style.accent } };
}

