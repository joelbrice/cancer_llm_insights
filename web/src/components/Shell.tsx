"use client";

import { brandName, LOCALE_NAMES, LOCALES, type Locale } from "@vitacite/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useLocale, useT } from "@/lib/i18n-client";
import { readLocal, writeLocal } from "@/lib/storage";

import { Icon, Logo } from "./Icon";
import { isActive, PRIMARY_NAV, SECONDARY_NAV } from "./nav";

const THEME_KEY = "vitacite.theme";
type Theme = "system" | "light" | "dark";

/** Inline, render-blocking script: applies the saved theme before first paint (no flash). */
export const THEME_SCRIPT = `(function(){try{var t=JSON.parse(localStorage.getItem('${THEME_KEY}')||'"system"');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;

function applyTheme(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(readLocal<Theme>(THEME_KEY, "system")), []);
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  const icon = theme === "light" ? "sun" : theme === "dark" ? "moon" : "monitor";
  const label = `${t("common.theme")}: ${t(theme === "light" ? "common.themeLight" : theme === "dark" ? "common.themeDark" : "common.themeSystem")}`;
  return (
    <button
      type="button"
      className={compact ? "btn btn-ghost h-11 w-11 !p-0" : "btn btn-ghost"}
      onClick={() => {
        const value = next[theme];
        setTheme(value);
        writeLocal(THEME_KEY, value);
        applyTheme(value);
      }}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} size={18} />
      {compact ? null : <span>{label}</span>}
    </button>
  );
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const lang = useLocale();
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t("common.language")}</span>
      <Icon name="globe" size={16} className="pointer-events-none absolute left-3 text-ink-2" />
      <select
        className="field !min-h-11 !w-auto cursor-pointer appearance-none !rounded-full !py-1 pl-9 pr-4 text-sm font-medium"
        value={lang}
        onChange={(event) => {
          const next = event.target.value as Locale;
          document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;samesite=lax`;
          const rest = pathname.split("/").slice(2).join("/");
          router.push(`/${next}${rest ? `/${rest}` : ""}${window.location.search}`);
        }}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Header() {
  const lang = useLocale();
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  const link = (path: string) => (path === "/" ? `/${lang}` : `/${lang}${path}`);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--bg)_75%,transparent)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href={link("/")} className="flex items-center gap-2 font-bold tracking-tight text-ink" aria-label={t("nav.home")}>
          <Logo />
          <span className="text-lg">{brandName()}</span>
        </Link>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
          {[...PRIMARY_NAV.slice(1), SECONDARY_NAV[0]!, SECONDARY_NAV[1]!].map((item) => {
            const active = isActive(pathname, lang, item.path);
            return (
              <Link
                key={item.key}
                href={link(item.path)}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${active ? "bg-brand-soft text-brand-strong" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
              >
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <div className="hidden sm:block">
            <ThemeToggle compact />
          </div>
          <button type="button" className="btn btn-ghost h-11 w-11 !p-0" onClick={() => setOpen(true)} aria-label={t("nav.menu")} aria-haspopup="dialog">
            <Icon name="menu" />
          </button>
        </div>
      </div>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && setOpen(false)}
        className="m-0 ml-auto h-dvh max-h-dvh w-[min(22rem,90vw)] max-w-none bg-surface p-0 text-ink shadow-card open:flex open:flex-col"
        aria-label={t("nav.menu")}
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <span className="font-semibold">{t("nav.menu")}</span>
          <button type="button" className="btn btn-ghost h-11 w-11 !p-0" onClick={() => setOpen(false)} aria-label={t("common.close")}>
            <Icon name="x" />
          </button>
        </div>
        <nav aria-label={t("nav.menu")} className="flex-1 overflow-y-auto p-2">
          {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => (
            <Link
              key={item.key}
              href={link(item.path)}
              aria-current={isActive(pathname, lang, item.path) ? "page" : undefined}
              className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-ink hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong"
            >
              <Icon name={item.icon} />
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2 border-t border-line p-4">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </dialog>
    </header>
  );
}

export function BottomNav() {
  const lang = useLocale();
  const t = useT();
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, lang, item.path);
          return (
            <li key={item.key}>
              <Link
                href={item.path === "/" ? `/${lang}` : `/${lang}${item.path}`}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium ${active ? "text-brand" : "text-ink-2"}`}
              >
                <Icon name={item.icon} size={22} />
                <span className="max-w-full truncate px-1">{t(`navShort.${item.key as "home" | "ask" | "insights" | "check" | "plan"}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}

export const LOCALE_LIST: readonly Locale[] = LOCALES;
