import { legacyLocaleCookie } from "@/lib/legacy-storage";
import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { detectLocale, isLocale, localeCookie } from "./config";
import { translator } from "./catalog";
export const getLocale = cache(async () => {
  const jar = await cookies();
  const preference = jar.get(localeCookie)?.value ?? jar.get(legacyLocaleCookie)?.value;
  return isLocale(preference) ? preference : detectLocale((await headers()).get("accept-language"));
});
export const getTranslations = cache(async () => translator(await getLocale()));
