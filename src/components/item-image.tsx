"use client";
import { useI18n } from "@/i18n/client";
import Image from "next/image";
import { useState } from "react";
import { findItem, itemSpriteUrl, itemName } from "@/lib/items";
export function ItemImage({ name }: { name: string }) {
  const { locale } = useI18n();
  const item = findItem(name);
  const label = item ? itemName(item, locale) : name;
  const src = itemSpriteUrl(name);
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || src === failed) return null;
  return (
    <span className="overlay-held-item" title={label}>
      <Image
        src={src}
        alt={label}
        width={24}
        height={24}
        unoptimized
        className="item-sprite pixel-sprite"
        onError={() => setFailed(src)}
      />
    </span>
  );
}
