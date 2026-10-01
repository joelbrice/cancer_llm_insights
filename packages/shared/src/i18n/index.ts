import { brandName } from "../brand";
import type { Locale } from "../types";
import { de } from "./de";
import { type Dictionary, en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { pt } from "./pt";

export type { Dictionary };

export const LOCALES: readonly Locale[] = ["en", "fr", "es", "pt", "de"] as const;
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, es, pt, de };

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every translatable key, e.g. "ask.title" — checked at compile time. */
export type MessageKey = Leaves<Dictionary>;
export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}

export function interpolate(template: string, params?: Params): string {
  const values: Params = { app: brandName(), ...params };
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    values[name] !== undefined ? String(values[name]) : match,
  );
}

export function createTranslator(locale: Locale): Translate {
  const dict = DICTIONARIES[locale] ?? en;
  return (key, params) => interpolate(lookup(dict, key) ?? lookup(en, key) ?? key, params);
}

/** Look up a dynamic key (e.g. a category id from the API) with a readable fallback. */
export function translateDynamic(t: Translate, prefix: string, id: string, fallback?: string): string {
  const key = `${prefix}.${id}` as MessageKey;
  const value = t(key);
  return value === key ? (fallback ?? id.replace(/_/g, " ")) : value;
}

/** Pick the best supported locale from Accept-Language / navigator.languages. */
export function negotiateLocale(preferences: readonly string[] | string | null | undefined): Locale {
  const list =
    typeof preferences === "string"
      ? preferences
          .split(",")
          .map((part) => {
            const [tag, q] = part.trim().split(";q=");
            return { tag: tag ?? "", q: q ? Number(q) : 1 };
          })
          .sort((a, b) => b.q - a.q)
          .map((x) => x.tag)
      : (preferences ?? []);
  for (const tag of list) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export function formatDate(locale: Locale, iso: string | null | undefined, style: "short" | "long" = "short"): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, style === "long" ? { dateStyle: "long" } : { dateStyle: "medium" }).format(date);
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale, value >= 10_000 ? { notation: "compact", maximumFractionDigits: 1 } : {}).format(value);
}
