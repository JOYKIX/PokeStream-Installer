"use client";
import { TypeBadgePicker } from "@/components/type-badge-picker";
import { useState,type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { Select, SelectOption } from "@/components/select";
import { TEAM_LAYOUTS, type SceneData } from "@/lib/model";
import { GAMES } from "@/lib/games";
import {
  badgeColumnOptions,
  teamLayout,
  badgeLayout,
} from "@/lib/overlay-layout";
import { Toggle } from "@/components/ui";
import type { StarterId } from "@/themes/catalog";
import type { CustomTheme } from "@/themes/custom/schema";
import { ColorField, NumberField, ThemeSelect } from "./controls";
import {
  external,
  isDynamic,
  PLATFORM_SIZES,
  PLATFORM_LABELS,
  type BuilderData,
  type BuilderElement,
  type BuilderAsset,
} from "./schema";
import { SpriteSelector } from "@/components/sprite-selector";
import {
  appearance,
  elementAppearance,
  followsStudioTheme,
} from "./appearance";
import { uploadBuilderImage } from "./upload-image";
export type BuilderContext = {
  active: boolean;
  starter: StarterId | null;
  themes: CustomTheme[];
  scenes: { id: string; name: string }[];
};
export function Inspector({
  data,
  selected,
  update,
  updateElement,
  context,
  scene,
  assets,
  onAsset,
  onError,
  obsPanel,
}: {
  data: BuilderData;
  selected: BuilderElement | undefined;
  update: (next: BuilderData) => void;
  updateElement: (next: BuilderElement) => void;
  context: BuilderContext;
  scene: SceneData | null;
  assets: BuilderAsset[];
  onAsset: (asset: BuilderAsset) => void;
  onError: (error: string) => void;
  obsPanel?:ReactNode;
}) {
  const { t } = useI18n(),
    [uploading, setUploading] = useState(false),
    e = selected;
  const badgeCount = scene ? GAMES[scene.game].badges.length : 0;
  const look = e
    ? elementAppearance(e, data, scene, context.themes)
    : appearance(data.theme, context.themes);
  async function upload(file: File) {
    if (!e || e.type !== "image") return;
    setUploading(true);
    try {
      const asset = await uploadBuilderImage(file);
      onAsset(asset);
      updateElement({
        ...e,
        height: e.ratioLocked
          ? Math.max(16, Math.min(2160, (e.width * asset.height) / asset.width))
          : e.height,
        properties: { ...e.properties, assetId: asset.id },
      });
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Import impossible. Réessaie.",
      );
    } finally {
      setUploading(false);
    }
  }
  const size = (key: "width" | "height", value: number) => {
    if (!e) return;
    const next = { ...e, [key]: value };
    if (e.ratioLocked || isDynamic(e)) {
      const ratio = e.width / e.height;
      if (key === "width")
        next.height = Math.max(16, Math.min(2160, value / ratio));
      else next.width = Math.max(16, Math.min(3840, value * ratio));
    }
    if (isDynamic(next) && isDynamic(e) && e.properties.scale !== undefined) {
      next.properties = {
        ...next.properties,
        scale:
          e.properties.scale *
          (key === "width" ? next.width / e.width : next.height / e.height),
      };
    }
    updateElement(next);
  };
  if (!e)
    return (
      <div className="builder-inspector">
        {obsPanel}
        <h2>{t("Scène")}</h2>
        <label className="builder-field">
          <span>{t("Nom")}</span>
          <input
            value={data.name}
            maxLength={60}
            onChange={(ev) => update({ ...data, name: ev.target.value })}
          />
        </label>
        <div className="builder-resolution">
          1920 × 1080 <span>16:9</span>
        </div>
        <label className="builder-field">
          <span>{t("Données Studio")}</span>
          <Select
            value={data.sceneId ?? "none"}
            onValueChange={(id) =>
              update({ ...data, sceneId: id === "none" ? null : id })
            }
          >
            <SelectOption value="none">
              {t("Choisir un profil Studio")}
            </SelectOption>
            {context.scenes.map((s) => (
              <SelectOption key={s.id} value={s.id}>
                {s.name}
              </SelectOption>
            ))}
          </Select>
        </label>
        <p className="builder-note">
          {t("L’équipe, les badges et Nuzlocke suivent ce profil.")}
        </p>
        <h3>{t("Thème principal")}</h3>
        <ThemeSelect
          {...context}
          value={data.theme}
          onChange={(theme) => {
            if (theme) update({ ...data, theme });
          }}
        />
        <ColorField
          label="Couleur d’accent"
          value={look.accent}
          onChange={(accent) =>
            update({ ...data, theme: { ...data.theme, accent } })
          }
          onReset={() => {
            const { accent: _accent, ...theme } = data.theme;
            update({ ...data, theme });
          }}
          resetDisabled={!data.theme.accent}
        />
        <button
          type="button"
          className="button secondary builder-apply-theme"
          onClick={() =>
            update({
              ...data,
              useStudioStyle: false,
              elements: data.elements.map((element) =>
                isDynamic(element)
                  ? {
                      ...element,
                      themeSource: "main",
                      themeOverride: null,
                      accentOverride: null,
                    }
                  : element,
              ),
            })
          }
        >
          {t("Appliquer à l’équipe, aux badges et Nuzlocke")}
        </button>
        <h3>{t("Fond")}</h3>
        <Select
          value={data.background.mode}
          onValueChange={(mode) =>
            update({
              ...data,
              background: {
                ...data.background,
                mode: mode as BuilderData["background"]["mode"],
              },
            })
          }
        >
          {[
            ["theme", "Thème principal"],
            ["color", "Couleur"],
            ["transparent", "Transparent"],
          ].map(([v, l]) => (
            <SelectOption key={v} value={v}>
              {t(l)}
            </SelectOption>
          ))}
        </Select>
        {data.background.mode === "color" && (
          <ColorField
            label="Couleur"
            value={data.background.color}
            onChange={(color) =>
              update({ ...data, background: { ...data.background, color } })
            }
          />
        )}
      </div>
    );
  return (
    <div className="builder-inspector">
      <h2>{t("Propriétés")}</h2>
      <label className="builder-field">
        <span>{t("Nom")}</span>
        <input
          value={e.name}
          maxLength={60}
          onChange={(ev) => updateElement({ ...e, name: ev.target.value })}
        />
      </label>
      {obsPanel}
      <Toggle
        label={t("Verrouiller")}
        checked={e.locked}
        onChange={(locked) => updateElement({ ...e, locked })}
      />
      <fieldset disabled={e.locked}>
        <div className="builder-fields">
          <NumberField
            label="X"
            value={e.x}
            onChange={(x) => updateElement({ ...e, x })}
          />
          <NumberField
            label="Y"
            value={e.y}
            min={-2160}
            max={2160}
            onChange={(y) => updateElement({ ...e, y })}
          />
          <NumberField
            label="Largeur"
            value={e.width}
            min={16}
            onChange={(v) => size("width", v)}
          />
          <NumberField
            label="Hauteur"
            value={e.height}
            min={16}
            max={2160}
            onChange={(v) => size("height", v)}
          />
        </div>
        {!isDynamic(e) && (
          <Toggle
            label="Verrouiller le ratio"
            checked={e.ratioLocked}
            onChange={(ratioLocked) => updateElement({ ...e, ratioLocked })}
          />
        )}
        {e.type === "team" && (
          <label className="builder-field">
            <span>{t("Disposition de l’équipe")}</span>
            <Select
              value={e.properties.layout ?? "studio"}
              onValueChange={(value) =>
                updateElement({
                  ...e,
                  properties: {
                    ...e.properties,
                    layout:
                      value === "studio"
                        ? null
                        : (value as (typeof TEAM_LAYOUTS)[number]),
                  },
                })
              }
            >
              <SelectOption value="studio">
                {t("Profil Studio")}
                {scene
                  ? " · " + teamLayout(scene.style).replace("x", " × ")
                  : ""}
              </SelectOption>
              {TEAM_LAYOUTS.map((layout) => (
                <SelectOption key={layout} value={layout}>
                  {layout.replace("x", " × ")}
                </SelectOption>
              ))}
            </Select>
          </label>
        )}
        {e.type === "badges" && (
          <label className="builder-field">
            <span>{t("Disposition des badges")}</span>
            <Select
              value={
                e.properties.columns == null
                  ? "studio"
                  : String(
                      badgeLayout(
                        {
                          ...(scene?.style ?? {}),
                          badgeColumns: e.properties.columns,
                        } as SceneData["style"],
                        badgeCount,
                      ),
                    )
              }
              onValueChange={(value) =>
                updateElement({
                  ...e,
                  properties: {
                    ...e.properties,
                    columns:
                      value === "studio"
                        ? null
                        : value === "auto"
                          ? "auto"
                          : Number(value),
                  },
                })
              }
            >
              <SelectOption value="studio">{t("Profil Studio")}</SelectOption>
              <SelectOption value="auto">{t("Auto")}</SelectOption>
              {badgeColumnOptions(badgeCount).map((columns) => (
                <SelectOption key={columns} value={String(columns)}>
                  {columns} × {badgeCount / columns}
                </SelectOption>
              ))}
            </Select>
            {scene && !badgeCount && (
              <span className="builder-note">
                {t("Aucun badge pour ce jeu.")}
              </span>
            )}
          </label>
        )}
        <div className="builder-fields">
          <NumberField
            label="Rotation"
            value={e.rotation}
            min={-180}
            max={180}
            onChange={(rotation) => updateElement({ ...e, rotation })}
          />
          <NumberField
            label="Opacité (%)"
            value={Math.round(e.opacity * 100)}
            min={0}
            max={100}
            onChange={(v) => updateElement({ ...e, opacity: v / 100 })}
          />
        </div>
        <h3>{t("Apparence")}</h3>
        <ThemeSelect
          {...context}
          inherit
          value={e.themeOverride}
          studio={
            isDynamic(e)
              ? {
                  selected: followsStudioTheme(e, data),
                  onSelect: () =>
                    updateElement({
                      ...e,
                      themeSource: "studio",
                      themeOverride: null,
                      accentOverride: null,
                    }),
                }
              : undefined
          }
          onChange={(themeOverride) =>
            updateElement({
              ...e,
              themeSource: "main",
              themeOverride,
              accentOverride: null,
            })
          }
        />
        <ColorField
          label="Couleur d’accent"
          value={look.accent}
          onChange={(accentOverride) => updateElement({ ...e, accentOverride })}
          onReset={() => updateElement({ ...e, accentOverride: null })}
          resetDisabled={!e.accentOverride}
        />
        {e.type === "team" && (
          <div className="builder-sprites">
            <TypeBadgePicker value={e.properties.typeBadgeStyle??scene?.style.typeBadgeStyle??scene?.style.customTheme?.types.badgeStyle??"text"} inherit={{active:!e.properties.typeBadgeStyle,label:"Profil Studio",onSelect:()=>updateElement({...e,properties:{...e.properties,typeBadgeStyle:null}})}} onChange={typeBadgeStyle=>updateElement({...e,properties:{...e.properties,typeBadgeStyle}})}/>
            <SpriteSelector
              style={{
                sprite: e.properties.sprite ?? scene?.style.sprite ?? "artwork",
                spriteVariant:
                  e.properties.spriteVariant ??
                  scene?.style.spriteVariant ??
                  "default",
              }}
              inherit={{
                active: !e.properties.sprite,
                label: "Profil Studio",
                onSelect: () =>
                  updateElement({
                    ...e,
                    properties: {
                      ...e.properties,
                      sprite: null,
                      spriteVariant: null,
                    },
                  }),
              }}
              onChange={(patch) =>
                updateElement({
                  ...e,
                  properties: {
                    ...e.properties,
                    sprite:
                      patch.sprite ??
                      e.properties.sprite ??
                      scene?.style.sprite ??
                      "artwork",
                    spriteVariant:
                      patch.spriteVariant ??
                      e.properties.spriteVariant ??
                      scene?.style.spriteVariant ??
                      "default",
                  },
                })
              }
            />
          </div>
        )}
        {external(e) && (
          <>
            {e.type === "game-screen" && (
              <>
                <h3>{t("Console")}</h3>
                <Select
                  value={e.properties.platform}
                  onValueChange={(p) => {
                    const platform = p as keyof typeof PLATFORM_SIZES,
                      [w, h] = PLATFORM_SIZES[platform];
                    updateElement({
                      ...e,
                      height: Math.max(16, Math.min(2160, (e.width * h) / w)),
                      properties: { ...e.properties, platform },
                    });
                  }}
                >
                  {Object.entries(PLATFORM_LABELS).map(([id, label]) => (
                    <SelectOption key={id} value={id}>
                      {t(label)}
                    </SelectOption>
                  ))}
                </Select>
                {e.properties.platform === "ds" && (
                  <Select
                    value={e.properties.screen}
                    onValueChange={(screen) =>
                      updateElement({
                        ...e,
                        properties: {
                          ...e.properties,
                          screen: screen as "top" | "bottom",
                        },
                      })
                    }
                  >
                    <SelectOption value="top">
                      {t("Écran supérieur")}
                    </SelectOption>
                    <SelectOption value="bottom">
                      {t("Écran inférieur")}
                    </SelectOption>
                  </Select>
                )}
              </>
            )}
            {e.type === "camera" && (
              <div className="builder-ratios">
                {[
                  [16, 9],
                  [4, 3],
                  [1, 1],
                ].map(([w, h]) => (
                  <button
                    key={w + ":" + h}
                    onClick={() =>
                      updateElement({
                        ...e,
                        height: Math.max(16, Math.min(2160, (e.width * h) / w)),
                      })
                    }
                  >
                    {w}:{h}
                  </button>
                ))}
              </div>
            )}
            <Toggle
              label="Zone transparente"
              checked={e.properties.transparent}
              onChange={(transparent) =>
                updateElement({
                  ...e,
                  properties: { ...e.properties, transparent },
                })
              }
            />
            <Toggle
              label="Afficher le cadre"
              checked={e.properties.showFrame}
              onChange={(showFrame) =>
                updateElement({
                  ...e,
                  properties: { ...e.properties, showFrame },
                })
              }
            />
            {e.properties.showFrame && (
              <NumberField
                label="Épaisseur du cadre"
                value={e.properties.frameWidth}
                min={2}
                max={64}
                onChange={(frameWidth) =>
                  updateElement({
                    ...e,
                    properties: { ...e.properties, frameWidth },
                  })
                }
              />
            )}
            <p className="builder-note">
              {t("Le cadre reste à l’extérieur des coordonnées de capture.")}
            </p>
          </>
        )}
        {e.type === "image" && (
          <>
            <h3>{t("Image")}</h3>
            <p className="builder-note">
              {t("Images inutilisées supprimées à l’enregistrement.")}
            </p>
            <p className="muted">{t("PNG, JPG ou WebP · 20 Mo par image")}</p>
            <label className="button secondary builder-upload">
              {uploading ? t("Import…") : t("Importer une image")}
              <input
                disabled={uploading}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(ev) => {
                  const file = ev.target.files?.[0];
                  if (file) void upload(file);
                  ev.target.value = "";
                }}
              />
            </label>
            <Select
              value={e.properties.assetId ?? "none"}
              onValueChange={(assetId) => {
                const a = assets.find((a) => a.id === assetId);
                updateElement({
                  ...e,
                  height:
                    a && e.ratioLocked
                      ? Math.max(
                          16,
                          Math.min(2160, (e.width * a.height) / a.width),
                        )
                      : e.height,
                  properties: {
                    ...e.properties,
                    assetId: assetId === "none" ? null : assetId,
                  },
                });
              }}
            >
              <SelectOption value="none">{t("Aucune image")}</SelectOption>
              {assets.map((a) => (
                <SelectOption value={a.id} key={a.id}>
                  {a.name}
                </SelectOption>
              ))}
            </Select>
            <Select
              value={e.properties.fit}
              onValueChange={(fit) =>
                updateElement({
                  ...e,
                  properties: {
                    ...e.properties,
                    fit: fit as "cover" | "contain",
                  },
                })
              }
            >
              <SelectOption value="contain">{t("Contenir")}</SelectOption>
              <SelectOption value="cover">{t("Remplir")}</SelectOption>
            </Select>
          </>
        )}
        {e.type === "text" && (
          <>
            <h3>{t("Texte")}</h3>
            <textarea
              aria-label={t("Texte")}
              value={e.properties.text}
              maxLength={500}
              rows={4}
              onChange={(ev) =>
                updateElement({
                  ...e,
                  properties: { ...e.properties, text: ev.target.value },
                })
              }
            />
            <Select
              value={e.properties.font}
              onValueChange={(font) =>
                updateElement({
                  ...e,
                  properties: {
                    ...e.properties,
                    font: font as "inter" | "space" | "pixel",
                  },
                })
              }
            >
              <SelectOption value="inter">Inter</SelectOption>
              <SelectOption value="space">Space Grotesk</SelectOption>
              <SelectOption value="pixel">Pixelify Sans</SelectOption>
            </Select>
            <NumberField
              label="Taille du texte"
              value={e.properties.size}
              min={8}
              max={240}
              onChange={(size) =>
                updateElement({ ...e, properties: { ...e.properties, size } })
              }
            />
            <Toggle
              label="Gras"
              checked={e.properties.bold}
              onChange={(bold) =>
                updateElement({ ...e, properties: { ...e.properties, bold } })
              }
            />
            <Toggle
              label="Couleur du thème"
              checked={e.properties.color === null}
              onChange={(inherit) =>
                updateElement({
                  ...e,
                  properties: {
                    ...e.properties,
                    color: inherit ? null : "#ffffff",
                  },
                })
              }
            />
            {e.properties.color && (
              <ColorField
                label="Couleur"
                value={e.properties.color}
                onChange={(color) =>
                  updateElement({
                    ...e,
                    properties: { ...e.properties, color },
                  })
                }
              />
            )}
            <Select
              value={e.properties.align}
              onValueChange={(align) =>
                updateElement({
                  ...e,
                  properties: {
                    ...e.properties,
                    align: align as "left" | "center" | "right",
                  },
                })
              }
            >
              {[
                ["left", "Gauche"],
                ["center", "Centre"],
                ["right", "Droite"],
              ].map(([v, l]) => (
                <SelectOption key={v} value={v}>
                  {t(l)}
                </SelectOption>
              ))}
            </Select>
          </>
        )}
        {["team", "badges", "nuzlocke"].includes(e.type) && (
          <p className="builder-note">
            {t("Les données restent synchronisées avec le profil Studio.")}
          </p>
        )}
      </fieldset>
    </div>
  );
}
