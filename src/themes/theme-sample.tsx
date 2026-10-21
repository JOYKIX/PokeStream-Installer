import type { CSSProperties } from "react";
import { THEMES, themeClassName, type ThemeId } from "./catalog";

// Small, image-free samples share the actual theme tokens; no network or observers per tile.
export function ThemeSample({ theme }: { theme: ThemeId }) {
  return <span className={"theme-sample " + themeClassName(theme)} aria-hidden="true"
    style={{ "--accent": THEMES[theme].defaultAccent ?? "#ef3340" } as CSSProperties}>
    <span className="theme-preview-card">
      <i className="theme-preview-screen"><i /></i>
      <i className="theme-preview-name" />
      <i className="theme-preview-level" />
      <i className="theme-preview-hp" />
    </span>
    <span className="theme-preview-case"><i /><i /><i /></span>
  </span>;
}
