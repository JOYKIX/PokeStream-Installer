"use client";
import { pokemonName } from "@/i18n/pokemon";
import { useI18n } from "@/i18n/client";
import { GenderIcon } from "./gender-icon";
import Image from "next/image";
import { Skull } from "lucide-react";
import { ShinyIcon } from "./shiny-icon";
import type { CSSProperties } from "react";
import { GAMES } from "@/lib/games";
import {
  teamElementOrder,
  type SceneData,
  type Pokemon,
} from "@/lib/model";
import {
  badgeColumns,
  itemSpriteScale,
  teamLayout,
} from "@/lib/overlay-layout";
import { TypeBadge } from "./type-badge";
import { PokemonImage } from "./pokemon-image";
import { ItemImage } from "./item-image";
import { PokemonHealth } from "./pokemon-health";
import { BadgeImprint } from "@/themes/shared/badge-imprint";
import { customThemeVariables } from "@/themes/custom/appearance";
import { themeClassName } from "@/themes/catalog";

// Sizing cards have the same markup and theme rules, but never load images.
function TeamCard({
  pokemon: p,
  style,
  reserved = false,
  position,
}: {
  pokemon: Pokemon;
  style: SceneData["style"];
  reserved?: boolean;
  position?: CSSProperties;
}) {
  const { t: tr, locale } = useI18n();
  const showSprites = style.showSprites !== false;
  const elementOrder = teamElementOrder(style.elementOrder);
  return (
    <div
      className={"overlay-mon" + (p.fainted ? " fainted" : "")}
      data-overlay-reserved={reserved || undefined}
      aria-hidden={reserved || undefined}
      style={position}
    >
      {elementOrder.map((element) => {
        switch (element) {
          case "sprite":
            return showSprites ? (
              <div className="overlay-mon-art" key={element}>
                <div className="overlay-sprite">
                  {reserved ? (
                    <span className="pokemon-image" />
                  ) : (
                    <PokemonImage
                      pokemon={p}
                      style={style.sprite}
                      variant={style.spriteVariant}
                      size={180}
                    />
                  )}
                  {!p.isEgg &&
                    style.showItems &&
                    p.item &&
                    (reserved ? (
                      <span className="overlay-held-item">
                        <span className="item-sprite pixel-sprite" />
                      </span>
                    ) : (
                      <ItemImage name={p.item} />
                    ))}
                </div>
              </div>
            ) : null;
          case "name":
            return style.showNames || style.showGender ? (
              <div
                className={
                  "overlay-mon-info" +
                  (!style.showNames &&
                  (p.isEgg || !p.gender || p.gender === "unknown")
                    ? " egg-metadata-space"
                    : "")
                }
                key={element}
              >
                <div className="overlay-name-line">
                  {style.showNames && (
                    <strong>
                      {!p.isEgg && p.shiny && style.showShiny !== false && <ShinyIcon label={tr("Chromatique")} />}
                      {pokemonName(p, locale)}
                    </strong>
                  )}
                  {style.showGender &&
                    !p.isEgg &&
                    (p.gender === "male" || p.gender === "female") && (
                      <span
                        className={"overlay-gender gender-" + p.gender}
                        role="img"
                        aria-label={
                          p.gender === "female" ? tr("Femelle") : tr("Mâle")
                        }
                      >
                        <GenderIcon gender={p.gender} />
                      </span>
                    )}
                </div>
              </div>
            ) : null;
          case "level":
            return style.showLevels ? (
              <div
                className={`overlay-mon-info${p.isEgg ? " egg-metadata-space" : ""}`}
                aria-hidden={p.isEgg || undefined}
                key={element}
              >
                <span className="overlay-level">
                  {tr("N. ")}
                  {p.level}
                </span>
              </div>
            ) : null;
          case "health":
            return style.showHealth ? (
              <PokemonHealth
                key={element}
                pokemon={p}
                showValues={style.showHealthValues !== false}
              />
            ) : null;
          case "types":
            return style.showTypes ? (
              <div
                className={`overlay-mon-info${p.isEgg ? " egg-metadata-space" : ""}`}
                aria-hidden={p.isEgg || undefined}
                key={element}
              >
                <div className="type-pills">
                  {p.types.map((type) => (
                    <TypeBadge key={type} type={type} style={style.typeBadgeStyle ?? style.customTheme?.types.badgeStyle ?? "text"} reserved={reserved}/>
                  ))}
                </div>
              </div>
            ) : null;
        }
      })}
    </div>
  );
}

// A full-capacity footprint depends on settings, never on occupied slots.
const SIZING_POKEMON: Pokemon = {
  speciesId: 1,
  pokemonId: 1,
  name: "Pokémon",
  apiName: "bulbasaur",
  nickname: "Pokémon",
  level: 100,
  shiny: true,
  fainted: false,
  gender: "female",
  hp: 2047,
  maxHp: 2047,
  item: "oran-berry",
  types: ["grass", "poison"],
};
const TEAM_SLOTS = [0, 1, 2, 3, 4, 5];

export function OverlayRenderer({
  data,
  part = "all",
}: {
  data: SceneData;
  part?: string;
}) {
  const { t: tr } = useI18n();
  const style = data.style;
  const customSizes =
    style.theme === "custom" ? style.customTheme?.sizes : undefined;
  const size = (key: keyof NonNullable<typeof customSizes>) =>
    (customSizes?.[key] ?? 100) / 100;
  const slot = part.startsWith("slot-") ? Number(part.slice(5)) - 1 : null;
  const showSprites = style.showSprites !== false;
  const hasTeamContent =
    showSprites || style.showNames || style.showLevels || style.showTypes;
  const visibleTeam = data.team.flatMap((pokemon, index) =>
    pokemon &&
    (hasTeamContent ||
      (!pokemon.isEgg &&
        ((style.showGender &&
          (pokemon.gender === "male" || pokemon.gender === "female")) ||
          (style.showHealth &&
            pokemon.hp !== undefined &&
            pokemon.maxHp !== undefined)))) &&
    (!pokemon.isEgg || showSprites || style.showNames) &&
    (slot === null || slot === index)
      ? [{ pokemon, index }]
      : [],
  );
  const reserveTeam = part === "all" || part === "team";
  const showTeam = reserveTeam
    ? hasTeamContent || style.showGender || style.showHealth
    : slot !== null && visibleTeam.length > 0;
  const columns = reserveTeam ? Number(teamLayout(style).split("x")[0]) : 1;
  const badges = GAMES[data.game].badges;
  const showBadges =
    badges.length > 0 &&
    (part === "badges" || (part === "all" && style.showBadges));
  const showDeaths = data.nuzlocke && (part === "deaths" || part === "all");
  return (
    <div
      data-type-colors={
        style.theme === "custom"
          ? style.customTheme?.types.natural
            ? "natural"
            : "custom"
          : undefined
      }
      data-type-mode={
        style.theme === "custom"
          ? (style.customTheme?.types.mode ?? "tonal")
          : undefined
      }
      className={`overlay-renderer ${themeClassName(style.theme)} ${showSprites ? "" : "without-sprites"} ${slot !== null ? "overlay-single" : ""}`}
      style={
        {
          ...(style.theme === "custom" && style.customTheme
            ? customThemeVariables(
                style.customTheme,
                style.customAccent ?? style.customTheme.accent,
              )
            : {}),
          "--accent":
            style.theme === "custom" && style.customTheme
              ? (style.customAccent ?? style.customTheme.accent)
              : style.accent,
          "--team-columns": columns,
          "--badge-columns": badgeColumns(style, badges.length),
          "--team-scale": style.teamScale ?? style.scale,
          "--badge-scale": (style.badgeScale ?? style.scale) * size("badges"),
          "--death-scale": (style.deathScale ?? style.scale) * size("counter"),
          "--sprite-scale": showSprites
            ? (style.spriteScale ?? 1) * size("sprite")
            : 1,
          "--name-scale": style.nameScale ?? 1,
          "--level-scale": style.levelScale ?? 1,
          "--type-scale": style.typeScale ?? 1,
          "--gender-scale": (style.genderScale ?? 1) * size("gender"),
          "--health-scale": style.healthScale ?? 1,
          "--item-scale": (style.itemScale ?? 1) * size("item"),
          "--item-sprite-scale": itemSpriteScale(style) * size("itemSprite"),
        } as CSSProperties
      }
    >
      {showTeam && (
        <div className="overlay-team-frame">
          <div
            className={
              "overlay-team" + (reserveTeam ? " overlay-team-reserved" : "")
            }
          >
            {reserveTeam &&
              TEAM_SLOTS.map((index) => (
                <TeamCard
                  key={"sizing-" + index}
                  pokemon={SIZING_POKEMON}
                  style={style}
                  reserved
                />
              ))}
            {visibleTeam.map(({ pokemon, index }) => (
              <TeamCard
                key={index}
                pokemon={pokemon}
                style={style}
                position={
                  reserveTeam
                    ? {
                        gridColumn: (index % columns) + 1 + " / span 1",
                        gridRow: Math.floor(index / columns) + 1 + " / span 1",
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
      {(showBadges || showDeaths) && (
        <div className="overlay-extras">
          {showBadges && (
            <div
              className={
                "overlay-badges" + (style.badgeBackground ? " badge-case" : "")
              }
            >
              {badges.map((badge, i) => {
                const earned = data.badges.includes(i);
                if (!style.badgeBackground) {
                  return (
                    <Image
                      unoptimized
                      key={badge.image}
                      src={badge.image}
                      alt={tr(badge.name)}
                      width={36}
                      height={36}
                      className={earned ? "" : "badge-locked"}
                    />
                  );
                }
                const label =
                  tr(badge.name) + " · " + tr(earned ? "obtenu" : "non obtenu");
                return (
                  <span
                    key={badge.image}
                    className={"badge-case-slot" + (earned ? " earned" : "")}
                    role="img"
                    aria-label={tr(label)}
                    title={tr(label)}
                  >
                    {earned ? (
                      <Image src={badge.image} alt="" width={44} height={44} unoptimized />
                    ) : (
                      <BadgeImprint image={badge.image} />
                    )}
                  </span>
                );
              })}
            </div>
          )}
          {showDeaths && (
            <div className="overlay-deaths">
              <Skull size={22} />
              <strong>{data.deaths}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
