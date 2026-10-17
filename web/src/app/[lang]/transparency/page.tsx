import { formatDate, formatNumber, type Cell, type Locale, type MessageKey, type Translate } from "@stepwell/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { ApiDown, PageHeader } from "@/components/blocks";
import { StatTile } from "@/components/charts";
import { Icon } from "@/components/Icon";
import { api, load } from "@/lib/api";
import { href, resolveLocale } from "@/lib/i18n";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ quarter?: string }> };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("transparency.title"), description: t("transparency.subtitle") };
}

function cell(lang: Locale, t: Translate, value: Cell, minCell: number): string {
  return value === null ? t("transparency.fewer", { n: minCell }) : formatNumber(lang, value);
}

function reason(t: Translate, code: string): string {
  const key = `transparency.reasons.${code}` as MessageKey;
  const text = t(key);
  return text === key ? t("transparency.reasons.other") : text;
}

function Breakdown({ title, rows, lang, t, minCell }: { title: string; rows: Record<string, Cell>; lang: Locale; t: Translate; minCell: number }) {
  const entries = Object.entries(rows).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
  return (
    <section className="card p-5">
      <h3 className="mb-3 font-semibold text-ink">{title}</h3>
      {entries.length ? (
        <dl className="divide-y divide-line text-sm">
          {entries.map(([code, value]) => (
            <div key={code} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-ink-2">{reason(t, code)}</dt>
              <dd className="font-semibold tabular-nums text-ink">{cell(lang, t, value, minCell)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-ink-2">{t("transparency.none")}</p>
      )}
    </section>
  );
}

export default async function TransparencyPage({ params, searchParams }: Props) {
  const { lang, t } = await resolveLocale(params);
  const { quarter } = await searchParams;
  const res = await load(() => api.transparency(quarter && /^\d{4}-Q[1-4]$/i.test(quarter) ? quarter : undefined));
  if (!res.data) return <ApiDown t={t} />;
  const r = res.data;
  const n = (v: Cell) => cell(lang, t, v, r.min_cell);
  const hours = (v: number | null) => (v === null ? t("transparency.notEnough") : t("transparency.hours", { n: formatNumber(lang, v) }));
  const pct = (v: number) => `${Math.round(v * 100)} %`;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title={t("transparency.title")} subtitle={t("transparency.subtitle")}>
        <nav aria-label={t("transparency.quarter")} className="flex flex-wrap gap-2">
          {r.available.map((q) => (
            <Link
              key={q}
              href={`${href(lang, "/transparency")}?quarter=${q}`}
              className={`chip ${q === r.quarter ? "!border-brand !bg-brand-soft !text-ink" : ""}`}
              aria-current={q === r.quarter ? "page" : undefined}
            >
              {q}
            </Link>
          ))}
        </nav>
      </PageHeader>

      {!r.complete ? (
        <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />
          {t("transparency.inProgress")}
        </p>
      ) : null}

      <section aria-labelledby="activity" className="space-y-3">
        <h2 id="activity" className="text-xl font-semibold text-ink">
          {t("transparency.activity")} · {r.quarter}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile label={t("transparency.submitted")} value={n(r.posts.submitted)} />
          <StatTile label={t("transparency.held")} value={n(r.posts.held_for_review)} />
          <StatTile label={t("transparency.returned")} value={n(r.posts.returned_to_author)} />
          <StatTile label={t("transparency.hidden")} value={n(r.posts.hidden_after_reports)} />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Breakdown title={t("transparency.heldByReason")} rows={r.held_by_reason} lang={lang} t={t} minCell={r.min_cell} />
        <Breakdown title={t("transparency.returnedByReason")} rows={r.returned_by_reason} lang={lang} t={t} minCell={r.min_cell} />
        <Breakdown title={t("transparency.reportsByReason")} rows={r.reports_by_reason} lang={lang} t={t} minCell={r.min_cell} />
      </div>

      <section aria-labelledby="decisions" className="space-y-3">
        <h2 id="decisions" className="text-xl font-semibold text-ink">
          {t("transparency.decisions")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatTile label={t("transparency.approved")} value={n(r.decisions.approved)} />
          <StatTile label={t("transparency.removed")} value={n(r.decisions.removed)} />
          <StatTile label={t("transparency.medianHours")} value={hours(r.decisions.median_hours_to_decision)} />
          <StatTile label={t("transparency.medianSafety")} value={hours(r.decisions.median_hours_safety_items)} />
        </div>
        <Breakdown title={t("transparency.removed")} rows={r.decisions.removed_by_reason} lang={lang} t={t} minCell={r.min_cell} />
      </section>

      <section aria-labelledby="appeals" className="space-y-3">
        <h2 id="appeals" className="text-xl font-semibold text-ink">
          {t("transparency.appeals")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatTile label={t("transparency.appealsReceived")} value={n(r.appeals.received)} />
          <StatTile label={t("transparency.overturned")} value={n(r.appeals.overturned)} />
          <StatTile label={t("transparency.upheld")} value={n(r.appeals.upheld)} />
          <StatTile label={t("transparency.suspensions")} value={n(r.suspensions)} />
        </div>
      </section>

      <section aria-labelledby="supported" className="card p-5">
        <h2 id="supported" className="mb-2 font-semibold text-ink">
          {t("transparency.feltSupported")}
        </h2>
        <p className="text-ink-2">
          {r.felt_supported
            ? t("transparency.feltSupportedValue", {
                yes: pct(r.felt_supported.yes),
                somewhat: pct(r.felt_supported.somewhat),
                no: pct(r.felt_supported.no),
                n: formatNumber(lang, r.felt_supported.responses),
              })
            : t("transparency.notEnough")}
        </p>
      </section>

      <p className="flex items-start gap-2 text-sm text-ink-2">
        <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
        {t("transparency.method", { n: r.min_cell })}
      </p>
      <p className="text-xs text-ink-3">{t("common.updated", { date: formatDate(lang, r.generated_at) })}</p>
      <Link href={href(lang, "/community/guidelines")} className="btn btn-ghost">
        {t("community.guidelinesTitle")}
      </Link>
    </div>
  );
}
