import {
  configureBrand,
  createTranslator,
  isLocale,
  negotiateLocale,
  STORAGE_KEYS,
  VitaCiteClient,
  type Locale,
  type Translate,
} from "@vitacite/shared";
import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import { getLocales } from "expo-localization";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { useStored } from "./storage";
import { palette, type Colors } from "./theme";

configureBrand({ name: process.env.EXPO_PUBLIC_APP_NAME });

export const API_URL_KEY = "vitacite.apiUrl";
type ThemePref = "system" | "light" | "dark";

const DEFAULT_API =
  process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl || "http://localhost:8000";

interface SettingsValue {
  locale: Locale;
  setLocale: (locale: Locale | null) => void;
  t: Translate;
  scheme: "light" | "dark";
  themePref: ThemePref;
  setThemePref: (pref: ThemePref) => void;
  colors: Colors;
  apiUrl: string;
  setApiUrl: (url: string | null) => void;
  api: VitaCiteClient;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const deviceLocale = negotiateLocale(getLocales().map((l) => l.languageTag));
  const [savedLocale, setSavedLocale] = useStored<string | null>(STORAGE_KEYS.locale, null);
  const [themePref, setThemePref] = useStored<ThemePref>(STORAGE_KEYS.theme, "system");
  const [savedApi, setSavedApi] = useStored<string | null>(API_URL_KEY, null);
  const system = useColorScheme();

  const locale: Locale = isLocale(savedLocale) ? savedLocale : deviceLocale;
  const scheme: "light" | "dark" = themePref === "system" ? (system === "dark" ? "dark" : "light") : themePref;
  const apiUrl = savedApi || DEFAULT_API;

  const value = useMemo<SettingsValue>(
    () => ({
      locale,
      setLocale: (l) => setSavedLocale(l),
      t: createTranslator(locale),
      scheme,
      themePref,
      setThemePref,
      colors: palette[scheme],
      apiUrl,
      setApiUrl: (url) => setSavedApi(url ? url.replace(/\/+$/, "") : null),
      // expo/fetch streams response bodies, so answers render token by token on device.
      api: new VitaCiteClient({ baseUrl: apiUrl, fetch: expoFetch as unknown as typeof fetch, timeoutMs: 30_000 }),
    }),
    [locale, scheme, themePref, apiUrl, setSavedLocale, setThemePref, setSavedApi],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}
