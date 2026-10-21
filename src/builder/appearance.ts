import type { CSSProperties } from "react";
import type { SceneData } from "@/lib/model";
import { THEMES, themeClassName, type ThemeId } from "@/themes/catalog";
import type { CustomThemeConfig } from "@/themes/custom/schema";
import { customThemeVariables } from "@/themes/custom/appearance";
import {
  isDynamic,
  type BuilderData,
  type BuilderElement,
  type ThemeRef,
} from "./schema";
export type DisplayTheme = { id: string; config: CustomThemeConfig };
function tokens(
  themeId: ThemeId,
  accent: string,
  config?: CustomThemeConfig,
  customId?: string,
) {
  return {
    themeId,
    accent,
    config,
    customId,
    className: "theme-sample " + themeClassName(themeId),
    style: {
      ...(config ? customThemeVariables(config, accent) : {}),
      "--accent": accent,
    } as CSSProperties,
  };
}
export function appearance(
  ref: ThemeRef,
  themes: DisplayTheme[],
  accentOverride?: string | null,
) {
  const config =
    ref.id === "custom"
      ? themes.find((t) => t.id === ref.customId)?.config
      : undefined;
  const id = ref.id === "custom" && !config ? "carbon" : ref.id;
  return tokens(
    id,
    accentOverride ??
      ref.accent ??
      config?.accent ??
      THEMES[id].defaultAccent ??
      "#ef3340",
    config,
    config ? ref.customId : undefined,
  );
}
export function followsStudioTheme(e: BuilderElement, data: BuilderData) {
  // Preserve earlier documents while giving each block an explicit source.
  return (
    isDynamic(e) &&
    !e.themeOverride &&
    (e.themeSource ? e.themeSource === "studio" : data.useStudioStyle !== false)
  );
}
export function elementAppearance(
  e: BuilderElement,
  data: BuilderData,
  scene: SceneData | null,
  themes: DisplayTheme[],
) {
  if (scene && followsStudioTheme(e, data)) {
    const style = scene.style,
      config = style.theme === "custom" ? style.customTheme : undefined;
    return tokens(
      style.theme,
      e.accentOverride ??
        (config ? (style.customAccent ?? config.accent) : style.accent),
      config,
      style.customThemeId,
    );
  }
  return appearance(e.themeOverride ?? data.theme, themes, e.accentOverride);
}
