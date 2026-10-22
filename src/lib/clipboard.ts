"use client";

type ClipboardBridge = { clipboard?: { writeText: (text: string) => Promise<void> } };

export async function copyText(text: string): Promise<void> {
  const bridge = (window as Window & { pokeStream?: ClipboardBridge }).pokeStream;
  if (bridge?.clipboard?.writeText) {
    await bridge.clipboard.writeText(text);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Older desktop shells deny Chromium clipboard permission; keep copying usable.
  }
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
  document.body.appendChild(field);
  try {
    field.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard unavailable.");
  } finally {
    field.remove();
    active?.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
  }
}
