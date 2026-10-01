import type { Audience } from "@stepwell/shared";
import Link from "next/link";

import { ApiDown, DataStatusCard, InsightCard } from "@/components/blocks";
import { Icon, type IconName } from "@/components/Icon";
import { AskBox } from "@/components/AskBox";
import { api, load } from "@/lib/api";
import { href, resolveLocale } from "@/lib/i18n";

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await resolveLocale(params);
  const [status, insights] = await Promise.all([
    load(() => api.status()),
    load(() => api.insights({ lang, page_size: 6 })),
  ]);

  const paths: { key: "prevention" | "treatment" | "after" | "caregivers"; audience: Audience; icon: IconName }[] = [
    { key: "prevention", audience: "prevention", icon: "leaf" },
    { key: "treatment", audience: "in_treatment", icon: "heart" },
    { key: "after", audience: "after_treatment", icon: "sunrise" },
    { key: "caregivers", audience: "caregivers", icon: "users" },
  ];

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface px-5 py-10 md:px-12 md:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--brand) 28%, transparent), transparent 70%)" }}
        />
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-strong">
          <Icon name="shield" size={16} />
          {t("app.tagline")}
        </p>
        <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-ink md:text-5xl">{t("home.heroTitle")}</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-2">{t("home.heroSubtitle")}</p>
        <div className="mt-6 max-w-2xl">
          <AskBox />
        </div>
        <div className="mt-6">{status.data ? <DataStatusCard status={status.data} lang={lang} t={t} /> : null}</div>
      </section>

      {!status.data ? <ApiDown t={t} /> : null}

      <section aria-labelledby="paths">
        <h2 id="paths" className="mb-4 text-xl font-semibold text-ink">
          {t("home.pathsTitle")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {paths.map((p) => (
            <li key={p.key}>
              <Link href={href(lang, `/insights?audience=${p.audience}`)} className="card group flex h-full gap-4 p-5 transition hover:shadow-card">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon name={p.icon} />
                </span>
                <span>
                  <span className="block font-semibold text-ink group-hover:text-brand-strong">{t(`home.${p.key}Title`)}</span>
                  <span className="mt-1 block text-sm text-ink-2">{t(`home.${p.key}Body`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {insights.data && insights.data.items.length ? (
        <section aria-labelledby="featured">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="featured" className="text-xl font-semibold text-ink">
              {t("home.featured")}
            </h2>
            <Link href={href(lang, "/insights")} className="text-sm font-semibold text-brand hover:underline">
              {t("common.viewAll")} →
            </Link>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {insights.data.items.map((insight) => (
              <InsightCard key={insight.id} insight={insight} lang={lang} t={t} />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="how" className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 id="how" className="text-xl font-semibold text-ink">
            {t("home.howTitle")}
          </h2>
          <Link href={href(lang, "/methodology")} className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">
            {t("nav.methodology")} →
          </Link>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {(["how1", "how2", "how3"] as const).map((key, i) => (
            <li key={key} className="card p-5">
              <span className="text-sm font-bold text-brand">0{i + 1}</span>
              <h3 className="mt-1 font-semibold text-ink">{t(`home.${key}Title`)}</h3>
              <p className="mt-1 text-sm text-ink-2">{t(`home.${key}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="community" className="overflow-hidden rounded-3xl border border-line bg-brand-soft p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-brand">
            <Icon name="users" size={24} />
          </span>
          <div className="flex-1">
            <h2 id="community" className="text-xl font-semibold text-ink">
              {t("home.communityTitle")}
            </h2>
            <p className="mt-1 max-w-2xl text-ink-2">{t("home.communityBody")}</p>
          </div>
          <Link href={href(lang, "/community")} className="btn btn-primary">
            {t("home.communityCta")}
          </Link>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-6 md:flex-row md:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Icon name="clipboard" size={24} />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold text-ink">{t("home.checkTitle")}</h2>
          <p className="text-sm text-ink-2">{t("home.checkBody")}</p>
        </div>
        <Link href={href(lang, "/check")} className="btn btn-primary">
          {t("home.checkCta")}
        </Link>
      </section>
    </div>
  );
}
