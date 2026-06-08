// i18n/index.ts — translation lookup + locale resolution.
//
// Catalogs are flat key → string maps (en.json is the source of truth). A
// missing key falls back: requested locale → English → the caller's `default`
// (stat/category/module labels pass their schema label as the default, so they
// render in English until a locale translates them) → the key itself.

import en from "./en.json" with { type: "json" };
import es from "./es.json" with { type: "json" };

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

const CATALOGS: Record<string, Record<string, string>> = { en, es };

export type TParams = Record<string, string | number> & { default?: string };
export type TFunc = (key: string, params?: TParams) => string;

function interpolate(s: string, params: TParams): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export function makeT(locale: string): TFunc {
  const cat = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
  const fallback = CATALOGS[DEFAULT_LOCALE];
  return (key, params = {}) => {
    const template = cat[key] ?? fallback[key] ?? params.default ?? key;
    return interpolate(template, params);
  };
}

function isSupported(l: string | null | undefined): l is Locale {
  return !!l && (SUPPORTED_LOCALES as readonly string[]).includes(l);
}

function cookieLocale(req: Request): string | undefined {
  const cookie = req.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === "lang") return decodeURIComponent(v.join("="));
  }
  return undefined;
}

function acceptLanguageLocale(req: Request): string | undefined {
  const header = req.headers.get("accept-language");
  if (!header) return undefined;
  // "es-MX,es;q=0.9,en;q=0.8" → base languages in priority order.
  return header
    .split(",")
    .map((p) => p.trim().split(";")[0].toLowerCase().split("-")[0])
    .find(isSupported);
}

// Precedence: explicit ?lang= override → persisted cookie → browser
// Accept-Language → default. The caller persists the resolved locale as a
// cookie on render, so a one-time ?lang= sticks.
export function resolveLocale(req: Request): Locale {
  const q = new URL(req.url).searchParams.get("lang");
  if (isSupported(q)) return q;
  const c = cookieLocale(req);
  if (isSupported(c)) return c;
  const al = acceptLanguageLocale(req);
  if (isSupported(al)) return al;
  return DEFAULT_LOCALE;
}
