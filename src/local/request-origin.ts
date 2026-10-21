/** Validate the browser-facing local authority, never Next.js's internal rewritten URL. */
export function localAuthority(request: Request): string | null {
  const host = request.headers.get("host");
  if (!host || !/^(127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(host)) return null;
  const port = Number(host.slice(host.lastIndexOf(":") + 1));
  if (port < 1 || port > 65535) return null;
  return "http://" + host;
}
export function localRequestAllowed(request: Request, requireOrigin = false): boolean {
  const authority = localAuthority(request);
  if (!authority || request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  return origin ? origin === authority : !requireOrigin;
}
