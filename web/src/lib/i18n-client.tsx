"use client";

import { configureBrand, createTranslator, type Locale, type Translate } from "@vitacite/shared";
import { createContext, useContext, useMemo, type ReactNode } from "react";

configureBrand({ name: process.env.NEXT_PUBLIC_APP_NAME });

const LocaleContext = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}
