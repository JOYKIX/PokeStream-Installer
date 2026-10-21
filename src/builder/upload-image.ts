import { authFetch } from "@/local/client";
import type { BuilderAsset } from "./schema";
import { prepareBuilderImage } from "./export";
export async function uploadBuilderImage(file: File): Promise<BuilderAsset> {
  const png = await prepareBuilderImage(file);
  const reservation = await authFetch("/api/builder/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: png.name.slice(0, 100), size: png.size }),
  });
  const prepared = await reservation.json();
  if (!reservation.ok)
    throw new Error(prepared.error || "Import impossible. Réessaie.");
  const response = await fetch(prepared.uploadUrl, {
    method: "PUT",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "image/png", "x-upsert": "false" },
    body: png,
  });
  if (!response.ok) throw new Error("Import impossible. Réessaie.");
  const complete = await authFetch(
    "/api/builder/assets/" + prepared.uploadId + "/complete",
    { method: "POST" },
  );
  const result = await complete.json();
  if (!complete.ok)
    throw new Error(result.error || "Import impossible. Réessaie.");
  return result.asset as BuilderAsset;
}
