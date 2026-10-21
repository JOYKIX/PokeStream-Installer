import { z } from "zod";
export const vipChangeSchema = z
  .object({
    userId: z.string().min(1).max(128),
    enabled: z.boolean(),
    durationDays: z.number().int().min(1).max(3650).nullable().optional(),
  })
  .strict();
export function activeRole(
  row: { role: string; expires_at: string | null } | null,
  now = Date.now(),
): "owner" | "vip" | null {
  if (row?.role === "owner") return "owner";
  if (
    row?.role === "vip" &&
    (row.expires_at === null || Date.parse(row.expires_at) > now)
  )
    return "vip";
  return null;
}
export function formatVipDate(value: string, locale: string = "en") {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}
