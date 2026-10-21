import { permanentRedirect } from "next/navigation";

// Preserve saved links and received-theme notifications after the rename.
export default async function LegacyThemeStudio({ searchParams }: {
  searchParams: Promise<{ theme?: string }>
}) {
  const { theme } = await searchParams;
  permanentRedirect("/theme-creator" + (theme ? "?theme=" + encodeURIComponent(theme) : ""));
}
