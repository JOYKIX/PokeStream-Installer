"use client";
import { useI18n } from "@/i18n/client";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from "react";
import { GripVertical } from "lucide-react";
import { TEAM_ELEMENTS, teamElementOrder, type TeamElement } from "@/lib/model";

const labels: Record<TeamElement, string> = {
  sprite: "Sprite", name: "Nom", level: "Niveau", types: "Types", health: "Barre de vie",
};

type Drag = {
  element: TeamElement;
  pointerId: number;
  startY: number;
  clientY: number;
  moved: boolean;
  original: TeamElement[];
  order: TeamElement[];
  stopListening?: () => void;
};

function move(order: readonly TeamElement[], element: TeamElement, index: number) {
  const next = order.filter((item) => item !== element);
  next.splice(index, 0, element);
  return next;
}

function scrollParent(element: HTMLElement) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return document.scrollingElement as HTMLElement;
}

export function OverlayElementOrder({
  value = TEAM_ELEMENTS,
  visible = TEAM_ELEMENTS,
  onChange,
}: {
  value?: readonly TeamElement[];
  visible?: readonly TeamElement[];
  onChange: (order: TeamElement[]) => void;
}) {
  const { t: tr } = useI18n();
  const instructionsId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useRef<Drag | null>(null);
  const scrollFrame = useRef(0);
  const focusFrame = useRef(0);
  const [draft, setDraft] = useState<TeamElement[] | null>(null);
  const [active, setActive] = useState<TeamElement | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const completeOrder = teamElementOrder(value);
  const visibleOrder = completeOrder.filter((element) => visible.includes(element));
  const order = draft ?? visibleOrder;
  // Hidden elements retain their saved position when the visible rows are reordered.
  function commitOrder(next: readonly TeamElement[]) {
    let index = 0;
    onChange(completeOrder.map((element) => visible.includes(element) ? next[index++] : element));
  }

  useEffect(() => () => {
    cancelAnimationFrame(scrollFrame.current);
    cancelAnimationFrame(focusFrame.current);
    drag.current?.stopListening?.();
    drag.current = null;
  }, []);

  function focusHandle(element: TeamElement) {
    cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      const handle = listRef.current?.querySelector<HTMLButtonElement>(
        '[data-element="' + element + '"] button',
      );
      handle?.focus({ preventScroll: true });
      handle?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }

  function updateTarget() {
    const current = drag.current;
    if (!current?.moved || !listRef.current) return;
    const rows = Array.from(listRef.current.children);
    let target = 0;
    let distance = Infinity;
    rows.forEach((row, index) => {
      const rect = row.getBoundingClientRect();
      const delta = Math.abs(current.clientY - (rect.top + rect.height / 2));
      if (delta < distance) { distance = delta; target = index; }
    });
    if (current.order.indexOf(current.element) === target) return;
    current.order = move(current.order, current.element, target);
    setDraft(current.order);
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, element: TeamElement) {
    if (!event.isPrimary || event.button !== 0 || drag.current || !listRef.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    drag.current = {
      element, pointerId: event.pointerId, startY: event.clientY,
      clientY: event.clientY, moved: false, original: [...visibleOrder], order: [...visibleOrder],
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      finishDrag(false);
    };
    const onBlur = () => finishDrag(false, false);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("blur", onBlur);
    drag.current.stopListening = () => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("blur", onBlur);
    };
    setActive(element);
    setDraft([...visibleOrder]);
    // Capture on the list, which stays mounted when its rows change position.
    listRef.current.setPointerCapture(event.pointerId);
    const scroller = scrollParent(listRef.current);
    let previousTime = event.timeStamp;
    function autoScroll(time: number) {
      const current = drag.current;
      if (!current) return;
      const elapsed = Math.min(32, time - previousTime);
      previousTime = time;
      if (current.moved) {
        const viewport = scroller === document.scrollingElement;
        const rect = scroller.getBoundingClientRect();
        const top = viewport ? 0 : Math.max(0, rect.top);
        const bottom = viewport ? window.innerHeight : Math.min(window.innerHeight, rect.bottom);
        const edge = 36;
        const speed = current.clientY < top + edge ? -1 : current.clientY > bottom - edge ? 1 : 0;
        if (speed) {
          scroller.scrollTop += speed * elapsed * 0.4;
          updateTarget();
        }
      }
      scrollFrame.current = requestAnimationFrame(autoScroll);
    }
    scrollFrame.current = requestAnimationFrame(autoScroll);
  }

  function finishDrag(commit: boolean, restoreFocus = true) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    current.stopListening?.();
    cancelAnimationFrame(scrollFrame.current);
    if (listRef.current?.hasPointerCapture(current.pointerId)) {
      listRef.current.releasePointerCapture(current.pointerId);
    }
    setActive(null);
    setDraft(null);
    // Save once per drop, so one undo restores the previous arrangement.
    if (commit && current.order.some((item, i) => item !== current.original[i])) {
      commitOrder(current.order);
      setAnnouncement(tr("{name} : position {position} sur {count}.", { name: tr(labels[current.element]), position: current.order.indexOf(current.element) + 1, count: visibleOrder.length }));
    } else if (!commit) {
      setAnnouncement(tr("Déplacement annulé."));
    }
    if (restoreFocus) focusHandle(current.element);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, element: TeamElement) {
    if (event.key === "Escape" && drag.current) {
      event.preventDefault();
      finishDrag(false);
      return;
    }
    if (drag.current) return;
    const index = visibleOrder.indexOf(element);
    const target = event.key === "ArrowUp" ? Math.max(0, index - 1)
      : event.key === "ArrowDown" ? Math.min(visibleOrder.length - 1, index + 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? visibleOrder.length - 1 : null;
    if (target === null) return;
    event.preventDefault();
    if (target === index) return;
    commitOrder(move(visibleOrder, element, target));
    setAnnouncement(tr("{name} : position {position} sur {count}.", { name: tr(labels[element]), position: target + 1, count: visibleOrder.length }));
    focusHandle(element);
  }

  return (
    <>
      <p className="reorder-sr-only" id={instructionsId}>
        {tr("Glisse une poignée pour déplacer l’élément. Au clavier, utilise les flèches haut et bas.")}</p>
      <ol
        ref={listRef}
        className="element-order-list"
        aria-label={tr("Ordre des éléments")}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current || current.pointerId !== event.pointerId) return;
          current.clientY = event.clientY;
          current.moved ||= Math.abs(event.clientY - current.startY) > 4;
          updateTarget();
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId === event.pointerId) finishDrag(true);
        }}
        onPointerCancel={(event) => {
          if (drag.current?.pointerId === event.pointerId) finishDrag(false);
        }}
        onLostPointerCapture={(event) => {
          if (event.target === listRef.current && drag.current?.pointerId === event.pointerId) {
            finishDrag(false, false);
          }
        }}
      >
        {order.map((element, index) => (
          <li key={element} data-element={element} data-dragging={active === element || undefined}>
            <button
              type="button"
              className="element-order-handle"
              disabled={order.length < 2}
              aria-label={tr("Déplacer ") + tr(labels[element]) + ", position " + (index + 1) + tr(" sur ") + order.length}
              aria-describedby={instructionsId}
              aria-keyshortcuts="ArrowUp ArrowDown Home End"
              title={tr("Déplacer ") + tr(labels[element])}
              onPointerDown={(event) => startDrag(event, element)}
              onKeyDown={(event) => onKeyDown(event, element)}
            >
              <GripVertical size={16} aria-hidden="true" />
            </button>
            <span>{tr(labels[element])}</span>
          </li>
        ))}
      </ol>
      <span className="reorder-sr-only" role="status" aria-live="polite">{announcement}</span>
    </>
  );
}
