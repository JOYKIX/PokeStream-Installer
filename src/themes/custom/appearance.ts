import type { CSSProperties } from "react";
import type { CustomThemeConfig, ThemeSurface } from "./schema";
import { TYPE_COLORS, type ThemeType } from "./schema";
const fonts = { inter: '"Inter Variable", sans-serif', space: '"Space Grotesk Variable", sans-serif', pixel: '"Pixelify Sans Variable", monospace' };
function foreground(hex: string) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? "#101014" : "#ffffff";
}
function alpha(color: string, opacity: number) {
  return color + Math.round(opacity * 2.55).toString(16).padStart(2, "0");
}
function background(s: ThemeSurface) {
  const base = s.gradient ? (s.gradientMode === "radial" ? "radial-gradient(circle at 50% 30%, " : "linear-gradient(" + s.angle + "deg, ") + alpha(s.color, s.opacity) + ", " + alpha(s.colorEnd, s.opacity) + ")" : alpha(s.color, s.opacity);
  const ink = alpha(s.patternColor, s.patternOpacity * s.opacity / 100), n = s.patternScale;
  const texture = s.pattern === "dots" ? "radial-gradient(" + ink + " 1px, transparent 1.5px) 0 0 / " + n + "px " + n + "px"
    : s.pattern === "grid" ? "linear-gradient(" + ink + " 1px, transparent 1px) 0 0 / " + n + "px " + n + "px, linear-gradient(90deg," + ink + " 1px, transparent 1px) 0 0 / " + n + "px " + n + "px"
    : s.pattern === "lines" ? "repeating-linear-gradient(135deg," + ink + " 0 1px,transparent 1px " + n + "px)" : "";
  return (texture ? texture + ", " : "") + base;
}
// Tokens come from bounded numbers, enums and hex colours, never raw CSS.
export function customThemeVariables(c: CustomThemeConfig, accent = c.accent): CSSProperties {
  const border = (s: ThemeSurface) => s.borderWidth + "px " + s.borderStyle + " " + s.border;
  const accentLine = c.accentWidth + "px solid " + accent;
  const shadow = (value: string) => value === "soft" ? "0 2px 4px #0008" : value === "outline" ? "-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000" : "none";
  const vars: Record<string, string | number> = {
    "--accent": accent, "--edition": accent, "--surface": background(c.card),
    "--screen": c.spritePanelVisible ? background(c.spritePanel) : "transparent",
    "--line": c.card.border, "--stroke": c.card.borderWidth + "px",
    "--card-radius": c.card.radius + "px", "--screen-radius": c.spritePanel.radius + "px",
    "--theme-card-min": c.cardWidth + "px", "--theme-card-top": c.cardPadding + "px",
    "--custom-card-padding": c.cardPadding + "px", "--custom-content-gap": c.contentGap + "px", "--custom-card-border": border(c.card),
    "--custom-name-tracking": c.name.tracking + "px", "--custom-level-tracking": c.level.tracking + "px",
    "--custom-name-case": c.name.uppercase ? "uppercase" : "none", "--custom-level-case": c.level.uppercase ? "uppercase" : "none",
    "--custom-name-shadow": shadow(c.name.shadow), "--custom-level-shadow": shadow(c.level.shadow),
    "--custom-sprite-rotation": c.spriteRotation + "deg", "--custom-sprite-filter": c.spriteEffect === "glow" ? "drop-shadow(0 0 8px " + accent + "80)" : c.spriteEffect === "shadow" ? "drop-shadow(0 5px 3px #0006)" : "none",
    "--custom-badge-gap": c.badgeGap + "px", "--custom-badge-padding": c.badgePadding + "px",
    "--custom-counter-direction": c.counterLayout === "vertical" ? "column" : "row", "--custom-counter-icon-display": c.counterIconVisible ? "block" : "none",
    "--theme-font": fonts[c.font], "--title-font": fonts[c.font],
    "--ink": c.name.color, "--muted-ink": c.level.color, "--theme-team-gap": c.spacing + "px",
    "--card-shadow": c.shadow === "soft" ? "0 3px 6px #0004, inset 0 1px 0 #ffffff0c" : c.shadow === "crisp" ? "3px 3px 0 #0009" : "none",
    "--custom-align": c.align, "--custom-justify": c.align === "left" ? "flex-start" : c.align === "right" ? "flex-end" : "center",
    "--custom-accent-top": c.cardAccent === "top" ? accentLine : border(c.card),
    "--custom-accent-bottom": c.cardAccent === "bottom" ? accentLine : border(c.card),
    "--custom-accent-left": c.cardAccent === "left" ? accentLine : border(c.card),
    "--custom-accent-right": c.cardAccent === "right" ? accentLine : border(c.card),
    "--custom-screen-border": c.spritePanelVisible ? border(c.spritePanel) : "0px solid transparent",
    "--custom-name-size": c.name.size / 100, "--custom-level-size": c.level.size / 100,
    "--custom-name-weight": c.name.bold ? 750 : 450, "--custom-level-weight": c.level.bold ? 700 : 450,
    "--custom-type-size": c.types.size / 100, "--pill-radius": c.types.radius + "px",
    "--custom-type-color": c.types.color, "--custom-type-bg": c.types.background,
    "--custom-type-intensity": c.types.intensity + "%",
    "--custom-gender-male-ink": foreground(c.gender.male), "--custom-gender-female-ink": foreground(c.gender.female),
    "--custom-gender-male": c.gender.male, "--custom-gender-female": c.gender.female, "--custom-gender-radius": c.gender.radius + "px",
    "--item-surface": background(c.item), "--item-radius": c.item.radius + "px", "--custom-item-border": border(c.item),
    "--hp-high": c.health.high, "--hp-medium": c.health.medium, "--hp-low": c.health.low,
    "--hp-track": c.health.track, "--hp-text": c.health.text, "--hp-radius": c.health.radius + "px",
    "--custom-hp-height": c.health.height + "px", "--custom-hp-border": c.health.border,
    "--hp-pattern": c.health.striped ? "repeating-linear-gradient(90deg,transparent 0 8px,#0003 8px 10px)" : "none",
    "--case-surface": background(c.badges), "--custom-case-border": border(c.badges), "--custom-case-radius": c.badges.radius + "px",
    "--custom-counter-bg": background(c.counter), "--custom-counter-border": border(c.counter),
    "--counter-radius": c.counter.radius + "px", "--custom-counter-text": c.counterText, "--custom-counter-icon": c.counterIcon,
  };
  for (const type of Object.keys(TYPE_COLORS) as ThemeType[]) {
    vars["--custom-type-" + type] = c.types.palette[type];
    vars["--custom-type-ink-" + type] = foreground(c.types.palette[type]);
  }
  return vars as CSSProperties;
}

