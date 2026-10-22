export function ShinyIcon({ label }: { label: string }) {
  return (
    <svg className="shiny-icon" viewBox="0 0 24 24" width="16" height="16" role="img" aria-label={label}>
      <path fill="currentColor" d="m9 4 2.4 6.6L18 13l-6.6 2.4L9 22l-2.4-6.6L0 13l6.6-2.4L9 4Zm10-3 1.2 3.8L24 6l-3.8 1.2L19 11l-1.2-3.8L14 6l3.8-1.2L19 1Z" />
    </svg>
  );
}
