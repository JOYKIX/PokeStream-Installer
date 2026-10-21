"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useI18n } from "@/i18n/client";
import { hexToHsv, hexToRgb, hsvToHex, parseHex, rgbToHex, type Hsv } from "@/lib/color";
import { NumberInput } from "./number-input";

const swatches = ["#ef3340", "#ff7043", "#fbbf24", "#4ade80", "#38bdf8", "#a78bfa", "#ffffff", "#111114"];
type ColorPickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

export function ColorPicker({ label, value, onChange, className = "", disabled }: ColorPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={"color-picker-trigger " + className}
          aria-label={t(label) + " · " + value.toUpperCase()}
          title={t(label)} disabled={disabled}
          style={{ "--picked-color": value } as CSSProperties}>
          <span aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="color-picker-backdrop" />
        <Dialog.Content className="color-picker-dialog" aria-describedby={undefined}>
          <div className="color-picker-heading">
            <Dialog.Title>{t(label)}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label={t("Fermer")}>
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {open && <ColorPanel value={value} onChange={onChange} />}
          <Dialog.Close className="button secondary color-picker-done">{t("Terminé")}</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ColorPanel({ value, onChange }: Pick<ColorPickerProps, "value" | "onChange">) {
  const { t } = useI18n();
  const id = useId();
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const rgb = hexToRgb(value);
  const initial = useState(value)[0];
  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  function update(next: Hsv) {
    setHsv(next);
    setHexDraft(null);
    onChange(hsvToHex(next));
  }
  function choose(hex: string) {
    const next = hexToHsv(hex);
    // Grey and black still retain the chosen hue for the next drag.
    setHsv({ ...next, h: next.s === 0 ? hsv.h : next.h });
    setHexDraft(null);
    onChange(hex);
  }
  function point(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    update({ ...hsv,
      s: clamp((event.clientX - rect.left) / rect.width * 100),
      v: clamp(100 - (event.clientY - rect.top) / rect.height * 100),
    });
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 1;
    const next = { ...hsv };
    switch (event.key) {
      case "ArrowLeft": next.s = clamp(hsv.s - step); break;
      case "ArrowRight": next.s = clamp(hsv.s + step); break;
      case "ArrowUp": next.v = clamp(hsv.v + step); break;
      case "ArrowDown": next.v = clamp(hsv.v - step); break;
      case "Home": next.s = 0; break;
      case "End": next.s = 100; break;
      default: return;
    }
    event.preventDefault();
    update(next);
  }
  return (
    <div className="color-picker-body">
      <div className="color-spectrum" role="slider" tabIndex={0}
        aria-label={t("Saturation et luminosité")} aria-describedby={id + "-keys"}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s)}
        aria-valuetext={t("Saturation {s} %, luminosité {v} %", { s: Math.round(hsv.s), v: Math.round(hsv.v) })}
        style={{ backgroundColor: "hsl(" + hsv.h + " 100% 50%)" }}
        onKeyDown={keyboard}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          point(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) point(event);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}>
        <span className="color-spectrum-cursor" aria-hidden="true"
          style={{ left: hsv.s + "%", top: (100 - hsv.v) + "%", background: value }} />
      </div>
      <p className="sr-only" id={id + "-keys"}>
        {t("Flèches gauche/droite : saturation. Haut/bas : luminosité. Maj : pas de 10 %.")}
      </p>
      <label className="sr-only" htmlFor={id + "-hue"}>{t("Teinte")}</label>
      <input id={id + "-hue"} className="color-hue" type="range" min={0} max={359}
        value={Math.round(hsv.h)} aria-valuetext={Math.round(hsv.h) + "°"}
        onChange={(event) => update({ ...hsv, h: Number(event.target.value) })} />
      <div className="color-hex-row">
        <button type="button" className="color-previous" title={t("Couleur initiale")}
          aria-label={t("Couleur initiale")} onClick={() => choose(initial)}
          style={{ background: initial }} />
        <label className="color-hex-field" htmlFor={id + "-hex"}>
          <span>HEX</span>
          <input id={id + "-hex"} value={hexDraft ?? value.toUpperCase()}
            spellCheck={false} autoComplete="off" maxLength={7}
            aria-label={t("Code couleur HEX")} aria-invalid={hexDraft !== null && !parseHex(hexDraft)}
            onChange={(event) => {
              const draft = event.target.value;
              const valid = parseHex(draft);
              if (valid) choose(valid);
              setHexDraft(draft);
            }}
            onBlur={() => setHexDraft(null)} />
        </label>
        <span className="color-current" aria-hidden="true" style={{ background: value }} />
      </div>
      <div className="color-rgb">
        {(["Rouge", "Vert", "Bleu"] as const).map((label, index) => (
          <div key={label}>
            <label htmlFor={id + "-" + index}>{t(label)}</label>
            <NumberInput id={id + "-" + index} label={t(label)}
              value={rgb[index]} min={0} max={255}
              onValueChange={(channel) => {
                if (channel === "" || !Number.isFinite(Number(channel))) return;
                const next = [...rgb];
                next[index] = Number(channel);
                choose(rgbToHex(next));
              }} />
          </div>
        ))}
      </div>
      <div className="color-swatches" role="group" aria-label={t("Couleurs rapides")}>
        {swatches.map((color) => (
          <button key={color} type="button" aria-label={color.toUpperCase()}
            aria-pressed={value.toLowerCase() === color}
            style={{ background: color }} onClick={() => choose(color)}>
            {value.toLowerCase() === color && <Check size={15} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}

