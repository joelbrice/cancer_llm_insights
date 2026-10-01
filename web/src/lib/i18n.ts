import { configureBrand, createTranslator, isLocale, type Locale, type Translate } from "@vitacite/shared";
import { notFound } from "next/navigation";

configureBrand({ name: process.env.NEXT_PUBLIC_APP_NAME });

/** Validate the [lang] route segment (404 for unsupported locales) and return a translator. */
export async function resolveLocale(params: Promise<{ lang: string }>): Promise<{ lang: Locale; t: Translate }> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { lang, t: createTranslator(lang) };
}

export function href(lang: Locale, path = ""): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${lang}` : `/${lang}${clean}`;
}
