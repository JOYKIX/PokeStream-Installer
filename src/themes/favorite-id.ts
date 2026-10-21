import { isThemeId, type ThemeId } from "./catalog";
export type FavoriteId = ThemeId | `custom-${string}`;
export function customFavoriteId(id: string): FavoriteId { return `custom-${id}`; }
export function isFavoriteId(value: unknown): value is FavoriteId {
 return (isThemeId(value) && value !== "custom") || (typeof value === "string" && /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

