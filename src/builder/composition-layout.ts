import type {ElementType} from "./schema";

export const COMPOSITION_CONSOLES = ["gb", "gbc", "gba", "ds", "3ds", "switch"] as const;
export const COMPOSITION_TEAM_LAYOUTS = ["6x1", "3x2", "2x3", "1x6"] as const;
export type CompositionOptions = {
  console: typeof COMPOSITION_CONSOLES[number];
  screens: "side" | "stack";
  camera: boolean;
  chat: boolean;
  team: boolean;
  badges: boolean;
  counter: boolean;
  teamLayout?: typeof COMPOSITION_TEAM_LAYOUTS[number];
  badgeColumns?: number | "auto";
  badgeCount?: number;
  cameraRatio?: number;
  focus?: "game" | "balanced";
};
type Size = {width: number; height: number};
export type CompositionMeasurements = {team?: Size; badges?: Partial<Record<number, Size>>; counter?: Size};
export type Placement = Size & {
  type: ElementType;
  role: "main" | "secondary" | "camera" | "chat" | "team" | "badges" | "counter";
  x: number;
  y: number;
  platform?: "gb" | "gbc" | "gba" | "ds" | "3ds-top" | "3ds-bottom" | "switch";
  screen?: "top" | "bottom";
  columns?: number;
};
export type CompositionProposal = {placements: Placement[]; score: number; compact: boolean};
type Rect = Size & {x: number; y: number};
type Module = Omit<Placement, "x" | "y" | "width" | "height"> & {
  ratio: number; target: number; minimum: number; maximum: number; weight: number;
};
type State = {placed: Placement[]; free: Rect[]; remaining: Module[]; value: number; rank: number};
const MARGIN = 32, GAP = 24, WIDTH = 1920 - MARGIN * 2, HEIGHT = 1080 - MARGIN * 2;
const validSize = (value?: Size): value is Size => !!value && Number.isFinite(value.width) && Number.isFinite(value.height) && value.width > 0 && value.height > 0;
export function compositionBadgeColumns(count: number) {
  return Array.from({length: Math.max(0, Math.floor(count))}, (_, i) => count - i).filter(n => count % n === 0);
}
function modules(options: CompositionOptions, measured: CompositionMeasurements, columns: number): Module[] {
  const dual = options.console === "ds" || options.console === "3ds";
  const ratio = options.console === "gb" || options.console === "gbc" ? 160 / 144 : options.console === "gba" ? 1.5 : options.console === "3ds" ? 5 / 3 : options.console === "switch" ? 16 / 9 : 4 / 3;
  const parts: Module[] = [{type: "game-screen", role: "main", platform: options.console === "3ds" ? "3ds-top" : options.console, screen: "top", ratio, target: 1280, minimum: 560, maximum: WIDTH, weight: 12}];
  if (dual) parts.push({type: "game-screen", role: "secondary", platform: options.console === "3ds" ? "3ds-bottom" : "ds", screen: "bottom", ratio: 4 / 3, target: 520, minimum: 256, maximum: 900, weight: 3.5});
  if (options.camera) parts.push({type: "camera", role: "camera", ratio: options.cameraRatio === 4 / 3 ? 4 / 3 : 16 / 9, target: 420, minimum: 280, maximum: 620, weight: 2.5});
  if (options.chat) parts.push({type: "chat", role: "chat", ratio: 0.72, target: 360, minimum: 280, maximum: 480, weight: 3});
  if (options.team) {
    const [cols, rows] = (options.teamLayout ?? "6x1").split("x").map(Number);
    const size = validSize(measured.team) ? measured.team : {width: cols * 180 + (cols - 1) * 16, height: rows * 250 + (rows - 1) * 16};
    const unit = size.width / cols;
    parts.push({type: "team", role: "team", ratio: size.width / size.height, target: size.width * 156 / unit, minimum: size.width * 78 / unit, maximum: size.width * 200 / unit, weight: 5});
  }
  if (options.badges && (options.badgeCount ?? 8) > 0) {
    const count = options.badgeCount ?? 8, rows = Math.ceil(count / columns);
    const size = validSize(measured.badges?.[columns]) ? measured.badges[columns]! : {width: columns * 48 + Math.max(0, columns - 1) * 12, height: rows * 48 + Math.max(0, rows - 1) * 12};
    const unit = size.width / columns;
    parts.push({type: "badges", role: "badges", columns, ratio: size.width / size.height, target: size.width * 60 / unit, minimum: size.width * 36 / unit, maximum: size.width * 76 / unit, weight: 1.8});
  }
  if (options.counter) {
    const ratio = validSize(measured.counter) ? measured.counter.width / measured.counter.height : 2.1;
    parts.push({type: "nuzlocke", role: "counter", ratio, target: 52 * ratio, minimum: 34 * ratio, maximum: 64 * ratio, weight: 0.7});
  }
  return parts;
}
const outset = (block: {type: ElementType}) => ["game-screen", "camera", "chat"].includes(block.type) ? 14 : 0;
const utility = (block: Module, width: number) => block.weight * Math.log(width / block.target) * (width > block.target ? block.role === "main" ? 0.8 : 0.12 : 1);
function maxWidth(block: Module, rect: Rect) { const padding = outset(block) * 2;return Math.min(block.maximum, rect.width - padding, (rect.height - padding) * block.ratio); }
function sizes(block: Module, rect: Rect) {
  const maximum = maxWidth(block, rect);
  if (maximum + 0.01 < block.minimum) return [];
  // Search pixel sizes and useful target sizes; there is no fixed region or template.
  const values = [maximum, Math.min(maximum, block.target)];
  const step = block.role === "main" ? 64 : block.role === "team" ? 48 : 40;
  for (let width = Math.floor(maximum / step) * step; width >= block.minimum; width -= step) values.push(width);
  values.push(block.minimum);
  return [...new Set(values.map(v => Math.floor(v)))].filter(v => v >= block.minimum - 1).map(width => ({width, height: width / block.ratio}));
}
function split(rect: Rect, size: Size, vertical: boolean): Rect[] {
  const right = rect.width - size.width - GAP, below = rect.height - size.height - GAP;
  return [
    ...(right > 0 ? [{x: rect.x + size.width + GAP, y: rect.y, width: right, height: vertical ? rect.height : size.height}] : []),
    ...(below > 0 ? [{x: rect.x, y: rect.y + size.height + GAP, width: vertical ? size.width : rect.width, height: below}] : []),
  ];
}
function screenFits(placed: Placement[], block: Module, rect: Rect, options: CompositionOptions) {
  if (block.role !== "secondary") return true;
  const main = placed.find(p => p.role === "main")!;
  return options.screens === "side" ? rect.x >= main.x + main.width + GAP - 1 : rect.y >= main.y + main.height + GAP - 1;
}
function rank(placed: Placement[], free: Rect[], remaining: Module[], value: number, options: CompositionOptions) {
  let potential = value;
  for (const block of remaining) {
    let available = 0;
    for (const rect of free) if (screenFits(placed, block, rect, options)) available = Math.max(available, maxWidth(block, rect));
    if (available + 1 < block.minimum) return -Infinity;
    potential += utility(block, available);
  }
  return potential;
}
function finalScore(state: State, focus: CompositionOptions["focus"]) {
  const width = Math.max(...state.placed.map(p => p.x + p.width + outset(p))), height = Math.max(...state.placed.map(p => p.y + p.height + outset(p)));
  const painted = state.placed.reduce((sum, p) => sum + p.width * p.height, 0);
  const secondary = state.placed.find(p => p.role === "secondary"), main = state.placed[0];
  // Prefer compact groups and aligned screens, not scattered blocks filling arbitrary slots.
  return state.value + Math.log(main.width / 1280) * (main.width > 1280 ? 0.8 : 1) * (focus === "balanced" ? -5 : 8) + painted / (WIDTH * HEIGHT) * 2 - (width * height - painted) / (WIDTH * HEIGHT) * 2 - (secondary ? Math.min(Math.abs(secondary.y - main.y), Math.abs(secondary.x - main.x)) / 1080 : 0);
}
function solve(parts: Module[], options: CompositionOptions): State[] {
  let beam: State[] = [{placed: [], free: [{x: 0, y: 0, width: WIDTH, height: HEIGHT}], remaining: parts, value: 0, rank: 0}];
  for (let depth = 0; depth < parts.length; depth++) {
    const next: State[] = [], seen = new Set<string>();
    for (const state of beam) {
      // The game is the anchor. Other modules may be placed in any order.
      for (let index = 0; index < state.remaining.length; index++) {
        if (depth === 0 && index !== 0) continue;
        const block = state.remaining[index], remaining = state.remaining.filter((_, i) => i !== index);
        for (let slot = 0; slot < state.free.length; slot++) {
          const rect = state.free[slot];
          if (!screenFits(state.placed, block, rect, options)) continue;
          for (const size of sizes(block, rect)) {
            const details = {type: block.type, role: block.role, platform: block.platform, screen: block.screen, columns: block.columns};
            const padding = outset(block), outer = {width: size.width + padding * 2, height: size.height + padding * 2};
            const placed = [...state.placed, {...details, x: rect.x + padding, y: rect.y + padding, ...size}], value = state.value + utility(block, size.width);
            for (const vertical of [true, false]) {
              const free = [...state.free.filter((_, i) => i !== slot), ...split(rect, outer, vertical)];
              const optimistic = rank(placed, free, remaining, value, options);
              if (!Number.isFinite(optimistic)) continue;
              const key = placed.map(p => `${p.role}:${p.x}:${p.y}:${p.width}`).sort().join("|") + "/" + free.map(r => `${r.x}:${r.y}:${r.width}:${r.height}`).sort().join("|");
              if (seen.has(key)) continue;
              seen.add(key);next.push({placed, free, remaining, value, rank: optimistic});
            }
          }
        }
      }
    }
    next.sort((a, b) => b.rank - a.rank);
    // Preserve size diversity so a large main screen cannot crowd out every other plan.
    const perAnchor = new Map<number, number>();
    beam = next.filter(state => {const anchor = Math.floor(state.placed[0].width / 96), count = perAnchor.get(anchor) ?? 0;perAnchor.set(anchor, count + 1);return count < 10;}).slice(0, 72);
    if (!beam.length) return [];
  }
  return beam.sort((a, b) => finalScore(b, options.focus) - finalScore(a, options.focus));
}
function distance(a: Placement[], b: Placement[]) {
  return a.reduce((sum, p) => {const other = b.find(q => q.role === p.role)!;return sum + Math.abs(p.x - other.x) + Math.abs(p.y - other.y) + Math.abs(p.width - other.width) + Math.abs(p.height - other.height);}, 0);
}
/** Search and score non-overlapping floorplans using measured content and readable sizes. */
export function generateCompositions(options: CompositionOptions, measured: CompositionMeasurements = {}): CompositionProposal[] {
  const badgeCount = options.badgeCount ?? 8, choices = compositionBadgeColumns(badgeCount);
  const columns = !options.badges || !choices.length ? [1] : typeof options.badgeColumns === "number" && choices.includes(options.badgeColumns) ? [options.badgeColumns] : choices;
  const candidates = columns.flatMap(cols => {
    const parts = modules(options, measured, cols), solved = solve(parts, options);
    return solved.map(state => {
      const occupiedWidth = Math.max(...state.placed.map(p => p.x + p.width + outset(p))), occupiedHeight = Math.max(...state.placed.map(p => p.y + p.height + outset(p)));
      const dx = Math.floor((WIDTH - occupiedWidth) / 2) + MARGIN, dy = Math.floor((HEIGHT - occupiedHeight) / 2) + MARGIN;
      const placements = state.placed.map(p => ({...p, x: p.x + dx, y: p.y + dy}));
      const team = placements.find(p => p.role === "team"), teamColumns = Number((options.teamLayout ?? "6x1").split("x")[0]);
      return {placements, score: finalScore(state, options.focus), compact: !!team && team.width / teamColumns < 120};
    });
  }).sort((a, b) => b.score - a.score);
  const proposals: CompositionProposal[] = [];
  for (const candidate of candidates) {
    if (proposals.every(previous => distance(previous.placements, candidate.placements) > 320)) proposals.push(candidate);
    if (proposals.length === 3) break;
  }
  return proposals;
}
export function compositionLayout(options: CompositionOptions, measured?: CompositionMeasurements): Placement[] {
  return generateCompositions(options, measured)[0]?.placements ?? [];
}
