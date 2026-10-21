"use client";
import { useI18n } from "@/i18n/client";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

export function Brand({ small = false }: { small?: boolean }) {
  const { t: tr } = useI18n();
  return (
    <Link className="brand" href="/" aria-label={tr("PokeStream, accueil")}>
      <span className="brand-symbol">
        <Image src="/logo/pokestream-logo-no-stand.svg" width={624} height={318} alt="" unoptimized />
      </span>
      {!small && (
        <span>
          Poke<span className="brand-light">Stream</span>
          <i />
        </span>
      )}
    </Link>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t: tr } = useI18n();
  const descriptionId = useId();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content
          className={`modal ${wide ? "modal-wide" : ""}`}
          aria-describedby={description ? descriptionId : undefined}
        >
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id={descriptionId}>
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-button" aria-label={tr("Fermer")}>
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  action,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description: string;
  action: string;
  onConfirm: () => void;
}) {
  const { t: tr } = useI18n();
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="modal-backdrop" />
        <AlertDialog.Content className="modal confirm-modal">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{tr(description)}</AlertDialog.Description>
          <div className="modal-actions">
            <AlertDialog.Cancel className="button secondary">
              {tr("Annuler")}</AlertDialog.Cancel>
            <AlertDialog.Action className="button primary" onClick={onConfirm}>
              {tr(action)}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { t: tr } = useI18n();
  return (
    <label className="toggle-row">
      <span>{tr(label)}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}
