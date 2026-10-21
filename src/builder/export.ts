import {
  BUILDER_IMAGE_MAX_BYTES,
  BUILDER_IMAGE_MAX_SIDE,
} from "./image-limits";
export async function exportBuilderPNG(node: HTMLElement, name: string) {
  await document.fonts.ready;
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map((img) =>
      img.decode().catch(() => undefined),
    ),
  );
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    width: 1920,
    height: 1080,
    canvasWidth: 1920,
    canvasHeight: 1080,
    pixelRatio: 1,
    cacheBust: false,
    style: { transform: "none", margin: "0" },
    skipAutoScale: true,
  });
  if (!blob) throw new Error("Export PNG impossible.");
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = (name.replace(/[^\p{L}\p{N}_-]/gu, "-") || "overlay") + ".png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function prepareBuilderImage(file: File): Promise<File> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > BUILDER_IMAGE_MAX_BYTES
  )
    throw new Error("Choisis une image PNG, JPG ou WebP (20 Mo maximum).");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    BUILDER_IMAGE_MAX_SIDE / bitmap.width,
    BUILDER_IMAGE_MAX_SIDE / bitmap.height,
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Import impossible. Réessaie.");
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob || blob.size > BUILDER_IMAGE_MAX_BYTES)
    throw new Error("Image trop volumineuse (20 Mo maximum).");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", {
    type: "image/png",
  });
}
