"use client";
import { pokemonName } from "@/i18n/pokemon";
import { localizedForms } from "@/i18n/pokemon";
import { itemName, findItem } from "@/lib/items";
import { useI18n } from "@/i18n/client";
import { Select, SelectOption } from "./select";
import { NumberInput } from "./number-input";
import { useEffect, useId, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, Trash2 } from "lucide-react";
import { PokemonImage } from "./pokemon-image";
import { Modal, Toggle } from "./ui";
import { ITEMS } from "@/lib/items";
import type { Pokemon } from "@/lib/model";
import type { PokemonForm } from "@/lib/pokemon";
import type { SpriteStyle, SpriteVariant } from "@/lib/sprite-options";
export function PokemonEditor({
  pokemon,
  slot,
  onClose,
  onSave,
  onRemove,
  onReplace,
  onMove,
  spriteStyle,
  spriteVariant,
}: {
  pokemon: Pokemon;
  slot: number;
  onClose: () => void;
  onSave: (p: Pokemon) => void;
  onRemove: () => void;
  onReplace: () => void;
  onMove: (direction: -1 | 1, draft: Pokemon) => void;
  spriteStyle?: SpriteStyle;
  spriteVariant?: SpriteVariant;
}) {
  const { t: tr, locale } = useI18n();
  const fieldId = useId();
  const [draft, setDraft] = useState(pokemon);
  const [forms, setForms] = useState<PokemonForm[]>([]);
  const [formError, setFormError] = useState(false);
  useEffect(() => {
    if (pokemon.isEgg) return;
    const controller = new AbortController();
    fetch(`/api/pokemon/${pokemon.speciesId}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setForms(data.forms))
      .catch((e) => {
        if (e.name !== "AbortError") setFormError(true);
      });
    return () => controller.abort();
  }, [pokemon.speciesId, pokemon.isEgg]);
  const patch = (p: Partial<Pokemon>) => setDraft((d) => ({ ...d, ...p }));
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={pokemonName({ ...pokemon, speciesId: pokemon.speciesId ?? pokemon.pokemonId, nickname: "" }, locale)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
          onClose();
        }}
      >
        <div className="edit-pokemon-art">
          <PokemonImage pokemon={draft} size={180}
            style={draft.isEgg ? spriteStyle : undefined}
            variant={draft.isEgg ? spriteVariant : undefined} />
          <button
            type="button"
            className="button secondary compact"
            onClick={onReplace}
          >
            <RefreshCw size={15} />
            {tr("Remplacer")}</button>
        </div>
        {!draft.isEgg && (
          <>
            <div className="field-pair">
              <label className="field">
                {tr("Surnom")}<input
                  value={draft.nickname}
                  placeholder={pokemonName({ ...pokemon, nickname: "" }, locale)}
                  maxLength={24}
                  onChange={(e) => patch({ nickname: e.target.value })}
                />
              </label>
                <div className="field">
                  <label htmlFor={fieldId + "-level"}>{tr("Niveau")}</label>
                  <NumberInput
                    id={fieldId + "-level"}
                    label={tr("Niveau")}
                    required
                    min={1}
                    max={100}
                    value={draft.level}
                    onValueChange={(value) => patch({ level: Number(value) })}
                  />
                </div>
            </div>
            <label className="field">
              {tr("Forme")}<Select
                aria-label={tr("Forme")}
                disabled={!forms.length}
                value={draft.pokemonId}
                onValueChange={(value) => {
                  const form = forms.find((f) => f.id === Number(value));
                  if (form)
                    patch({
                      pokemonId: form.id,
                      apiName: form.name,
                      types: form.types,
                    });
                }}
              >
                {!forms.length && (
                  <SelectOption value={draft.pokemonId}>
                    {formError ? tr("Indisponible") : tr("Chargement…")}
                  </SelectOption>
                )}
                {forms.map((f) => (
                  <SelectOption key={f.id} value={f.id}>
                    {f.label === "Classique" ? tr("Classique") : localizedForms[locale]?.[String(f.id)] || tr(f.labelEn || f.label) || f.name}
                  </SelectOption>
                ))}
              </Select>
            </label>
            <label className="field">
              {tr("Objet tenu")}<input
                list="held-items"
                value={findItem(draft.item) ? itemName(findItem(draft.item)!, locale) : draft.item}
                maxLength={40}
                placeholder={tr("Aucun")}
                onChange={(e) => patch({ item: findItem(e.target.value)?.slug || e.target.value })}
              />
            </label>
            <datalist id="held-items">
              {ITEMS.map((item) => (
                <option key={item.slug} value={itemName(item, locale)}>
                  {itemName(item, locale)}
                </option>
              ))}
            </datalist>
            <label className="field">
              {tr("Sexe")}<Select
                aria-label={tr("Sexe")}
                value={draft.gender ?? "unknown"}
                onValueChange={(value) =>
                  patch({ gender: value as Pokemon["gender"] })
                }
              >
                <SelectOption value="unknown">{tr("Non renseigné / asexué")}</SelectOption>
                <SelectOption value="male">{tr("Mâle")}</SelectOption>
                <SelectOption value="female">{tr("Femelle")}</SelectOption>
              </Select>
            </label>
            <Toggle label={tr("Renseigner les PV")} checked={draft.maxHp !== undefined}
              onChange={(enabled) => patch(enabled ? { hp: draft.fainted ? 0 : 1, maxHp: 1 } : { hp: undefined, maxHp: undefined })} />
            {draft.maxHp !== undefined && <div className="field-pair">
              <div className="field">
                <label htmlFor={fieldId + "-hp"}>{tr("PV actuels")}</label>
                <NumberInput id={fieldId + "-hp"} label={tr("PV actuels")} required min={0} max={draft.maxHp} value={draft.hp ?? 0}
                  onValueChange={(value) => patch({ hp: Number(value), fainted: Number(value) === 0 })} />
              </div>
              <div className="field">
                <label htmlFor={fieldId + "-max-hp"}>{tr("PV maximum")}</label>
                <NumberInput id={fieldId + "-max-hp"} label={tr("PV maximum")} required min={1} max={2047} value={draft.maxHp}
                  onValueChange={(value) => { const maxHp = Number(value); patch({ maxHp, hp: Math.min(draft.hp ?? 0, maxHp) }); }} />
              </div>
            </div>}
            <Toggle
              label={tr("Chromatique")}
              checked={draft.shiny}
              onChange={(v) => patch({ shiny: v })}
            />
            <Toggle
              label="K.O."
              checked={draft.fainted}
              onChange={(v) => patch({ fainted: v, ...(v && draft.hp !== undefined ? { hp: 0 } : {}) })}
            />
          </>
        )}
        <div className="reorder-controls">
          <span>{tr("Position")} {slot + 1} / 6</span>
          <button
            type="button"
            disabled={slot === 0}
            className="icon-button"
            aria-label={tr("Déplacer à gauche")}
            onClick={() => onMove(-1, draft)}
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            disabled={slot === 5}
            className="icon-button"
            aria-label={tr("Déplacer à droite")}
            onClick={() => onMove(1, draft)}
          >
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="button danger-ghost"
            onClick={() => {
              onRemove();
              onClose();
            }}
          >
            <Trash2 size={16} />
            {tr("Retirer")}</button>
          <button type="submit" className="button primary">
            {tr("Appliquer")}</button>
        </div>
      </form>
    </Modal>
  );
}
