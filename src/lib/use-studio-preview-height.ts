"use client";
import { useLayoutEffect, useRef, useState } from "react";

// Keep this breakpoint in sync with the pinned desktop layout in site.css.
const DESKTOP_WORKSPACE = "(min-width: 961px) and (min-height: 600px)";
const PREVIEW_CHROME_HEIGHT = 152; // Heading, canvas padding and borders.
const MIN_EDITOR_HEIGHT = 180;

export function useStudioPreviewHeight() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(360);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const desktop = window.matchMedia(DESKTOP_WORKSPACE);
    const measure = () => {
      const height = desktop.matches
        ? Math.max(
            60,
            Math.min(360, content.clientHeight - PREVIEW_CHROME_HEIGHT - MIN_EDITOR_HEIGHT),
          )
        : 360;
      setMaxHeight(height);
    };
    // Only react to layout changes; scrolling does not rerender the studio.
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    desktop.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", measure);
    };
  }, []);

  return { contentRef, maxHeight };
}
