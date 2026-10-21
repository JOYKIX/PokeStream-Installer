"use client";
import { pokemonName } from "@/i18n/pokemon";
import { useI18n } from "@/i18n/client";
import Image from "next/image";
import { useState } from "react";
import { CircleHelp } from "lucide-react";
import type { Pokemon, SceneData } from "@/lib/model";
import { spriteCandidates } from "@/lib/sprites";
import type { SpriteVariant } from "@/lib/sprite-options";

export function PokemonImage({
  pokemon,
  style = "artwork",
  variant = "default",
  size = 160,
  priority = false,
}: {
  pokemon: Pick<Pokemon, "pokemonId" | "shiny" | "name" | "isEgg"> &
    Partial<Pick<Pokemon, "speciesId" | "gender" | "formSprite">>;
  style?: SceneData["style"]["sprite"];
  variant?: SpriteVariant;
  size?: number;
  priority?: boolean;
}) {
  const { t: tr, locale } = useI18n();
  const name = pokemonName({ ...pokemon, speciesId: pokemon.speciesId ?? pokemon.pokemonId, nickname: "" }, locale);
  const choices = spriteCandidates(pokemon, style, variant);
  const [failed, setFailed] = useState<string[]>([]);
  const selected = choices.find((candidate) => !failed.includes(candidate.url));
  if (!selected)
    return (
      <CircleHelp
        className="missing-sprite"
        size={size / 2}
        aria-label={name}
      />
    );
  return (
    <Image
      src={selected.url}
      alt={name}
      width={size}
      height={size}
      unoptimized
      priority={priority}
      title={
        selected.source !== style
          ? name + tr(" · sprite de remplacement")
          : undefined
      }
      className={"pokemon-image" + (selected.pixelated ? " pixel-sprite" : "") +
        (pokemon.isEgg && variant.includes("gray") ? " egg-grayscale" : "")}
      onError={() => setFailed((old) => [...old, selected.url])}
      draggable={false}
    />
  );
}
