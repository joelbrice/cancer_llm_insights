import "../globals.css";

import { brandName, BRAND, createTranslator, LOCALES } from "@stepwell/shared";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { BottomNav, Header, ServiceWorker, THEME_SCRIPT } from "@/components/Shell";
import { WelcomeNotice } from "@/components/WelcomeNotice";
import { href, resolveLocale } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang, t } = await resolveLocale(params);
  const name = brandName();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${name} — ${t("app.descriptor")}`, template: `%s · ${name}` },
    description: t("app.description"),
    applicationName: name,
    alternates: { canonical: `/${lang}`, languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
    openGraph: { type: "website", siteName: name, title: `${name} — ${t("app.descriptor")}`, description: t("app.description"), locale: lang },
    appleWebApp: { capable: true, title: BRAND.shortName, statusBarStyle: "default" },
    icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default async function RootLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await resolveLocale(params);
  const t = createTranslator(lang);
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="min-h-dvh">
        {/* Applies the saved theme before first paint. Kept in <body>: a hand-written <head> collides with the
            metadata Next.js streams into the head and causes intermittent hydration mismatches. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <I18nProvider locale={lang}>
          <a href="#main" className="skip-link">
            {t("nav.skip")}
          </a>
          <Header />
          <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:pb-16">
            {children}
          </main>
          <footer className="border-t border-line bg-surface pb-24 lg:pb-0">
            <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm text-ink-2 md:grid-cols-[2fr_1fr]">
              <p className="flex gap-2">
                <span aria-hidden="true">⚕︎</span>
                {t("disclaimer.full")}
              </p>
              <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2 md:justify-end">
                <Link className="hover:underline" href={href(lang, "/methodology")}>{t("nav.methodology")}</Link>
                <Link className="hover:underline" href={href(lang, "/library")}>{t("nav.library")}</Link>
                <Link className="hover:underline" href={href(lang, "/about")}>{t("nav.about")}</Link>
                <Link className="hover:underline" href={href(lang, "/admin")}>{t("nav.admin")}</Link>
              </nav>
            </div>
          </footer>
          <BottomNav />
          <ServiceWorker />
          <WelcomeNotice />
        </I18nProvider>
      </body>
    </html>
  );
}
