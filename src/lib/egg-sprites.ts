import { spriteSource, type SpriteStyle, type SpriteVariant } from "./sprite-options";
import type { SpriteCandidate } from "./sprites";

const BASE = "/sprites/eggs/";

export function eggSpriteCandidates(style: SpriteStyle, variant: SpriteVariant): SpriteCandidate[] {
  const back = variant.startsWith("back");
  const requested = spriteSource(style);
  let file: string;
  let source: SpriteStyle;
  // The catalogs do not provide an egg for every game or animation collection.
  // Keep replacements within the same visual family and always use a real egg.
  if (style.startsWith("icons-")) {
    file = "icons.png";
    source = "icons-vii";
  } else if (style === "scarlet-violet" || style === "champions") {
    file = "scarlet-violet.png";
    source = "scarlet-violet";
  } else if (requested.path.startsWith("versions/generation-iv/")) {
    file = "heartgold-soulsilver.png";
    source = "heartgold-soulsilver";
  } else if (style === "black-white" || style === "black-white-animated") {
    file = back ? "black-white-back.png" : "black-white.png";
    source = "black-white";
  } else if (style === "animated" || !requested.pixelated) {
    file = "home.png";
    source = "home";
  } else {
    file = back ? "back.png" : "default.png";
    source = "pixel";
  }
  const primary = { url: BASE + file, pixelated: spriteSource(source).pixelated, source };
  const fallback: SpriteCandidate = {
    url: BASE + (primary.pixelated ? "default.png" : "home.png"),
    pixelated: primary.pixelated,
    source: primary.pixelated ? "pixel" : "home",
  };
  return primary.url === fallback.url ? [primary] : [primary, fallback];
}
