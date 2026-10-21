export type Hsv = { h: number; s: number; v: number };
export function parseHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, "");
  if (/^[a-f\d]{3}$/i.test(hex))
    return "#" + [...hex].map((c) => c + c).join("").toLowerCase();
  return /^[a-f\d]{6}$/i.test(hex) ? "#" + hex.toLowerCase() : null;
}
export function hexToRgb(value: string): [number, number, number] {
  const hex = parseHex(value) ?? "#000000";
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}
export function rgbToHex(rgb: readonly number[]): string {
  return "#" + rgb.map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
export function hexToHsv(value: string): Hsv {
  const [r, g, b] = hexToRgb(value).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? delta / max * 100 : 0, v: max * 100 };
}
export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v / 100 * s / 100;
  const x = c * (1 - Math.abs(h / 60 % 2 - 1));
  const m = v / 100 - c;
  const rgb = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x]
    : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
  return rgbToHex(rgb.map((channel) => (channel + m) * 255));
}

