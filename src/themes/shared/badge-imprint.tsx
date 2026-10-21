import { useId } from "react";

/** One shared recess, cut from the badge's alpha silhouette, never its colours. */
export function BadgeImprint({ image }: { image: string }) {
  const filterId = "badge-recess-" + useId().replace(/:/g, "");
  return (
    <svg className="badge-imprint" viewBox="0 0 44 44" width="44" height="44"
      aria-hidden="true" focusable="false">
      <defs>
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%"
          colorInterpolationFilters="sRGB">
          {/* A narrow lower lip catches light outside the cut. */}
          <feOffset in="SourceAlpha" dy="0.8" result="lip-offset" />
          <feComposite in="lip-offset" in2="SourceAlpha" operator="out" result="lip-edge" />
          <feFlood floodColor="#fff" floodOpacity="0.28" />
          <feComposite in2="lip-edge" operator="in" result="lip" />
          {/* Translucent shading keeps the case's own colour and texture. */}
          <feFlood floodColor="#000" floodOpacity="0.2" />
          <feComposite in2="SourceAlpha" operator="in" result="floor" />
          {/* Shift the same silhouette, without resizing it, to cast an inner shadow. */}
          <feOffset in="SourceAlpha" dy="1.5" result="shadow-offset" />
          <feGaussianBlur in="shadow-offset" stdDeviation="1" result="shadow-soft" />
          <feComposite in="SourceAlpha" in2="shadow-soft" operator="out" result="shadow-edge" />
          <feFlood floodColor="#000" floodOpacity="0.65" />
          <feComposite in2="shadow-edge" operator="in" result="inner-shadow" />
          <feMerge>
            <feMergeNode in="lip" />
            <feMergeNode in="floor" />
            <feMergeNode in="inner-shadow" />
          </feMerge>
        </filter>
      </defs>
      <image href={image} width="44" height="44" preserveAspectRatio="xMidYMid meet"
        filter={"url(#" + filterId + ")"} />
    </svg>
  );
}
