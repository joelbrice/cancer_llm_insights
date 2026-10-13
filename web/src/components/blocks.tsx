import {
  formatDate,
  formatNumber,
  translateDynamic,
  type InsightSummary,
  type Locale,
  type PlatformStatus,
  type Translate,
} from "@stepwell/shared";
import Link from "next/link";
import type { ReactNode } from "react";

import { href } from "@/lib/i18n";

import { EvidenceBadge } from "./evidence";
import { Icon } from "./Icon";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-ink-2">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Disclaimer({ t }: { t: Translate }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
      <Icon name="info" size={16} className="mt-0.5 shrink-0" />
      {t("disclaimer.short")}
    </p>
  );
}

export function ApiDown({ t }: { t: Translate }) {
  return (
    <div className="card flex items-start gap-3 p-5" role="alert">
      <Icon name="alert" className="mt-0.5 shrink-0 text-warning-ink" />
      <div>
        <p className="font-semibold">{t("common.error")}</p>
        <p className="text-ink-2">{t("common.apiUnreachable")}</p>
      </div>
    </div>
  );
}

/** Platform data status — the "waiting for data" state is a first-class, explained screen. */
export function DataStatusCard({ status, lang, t }: { status: PlatformStatus; lang: Locale; t: Translate }) {
  if (status.data_status === "ready") {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-ink-2">
        <span className="h-2 w-2 rounded-full bg-good" aria-hidden="true" />
        {t("status.ready", { documents: formatNumber(lang, status.documents), insights: formatNumber(lang, status.insights) })}
      </p>
    );
  }
  const indexing = status.data_status === "indexing" && status.active_job;
  return (
    <section className="card overflow-hidden" aria-live="polite">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Icon name={status.data_status === "degraded" ? "alert" : "database"} size={24} />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-ink">
            {status.data_status === "degraded" ? t("status.degraded") : t("status.awaitingTitle")}
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {indexing
              ? t("status.indexing", { progress: `${Math.round((status.active_job?.progress ?? 0) * 100)}%` })
              : t("status.awaitingBody")}
          </p>
        </div>
        <Link href={href(lang, "/admin")} className="btn btn-ghost shrink-0">
          {t("status.sourcesLink")}
          <Icon name="chevronRight" size={16} />
        </Link>
      </div>
      {indexing ? (
        <div className="h-1 bg-surface-3">
          <div className="h-full bg-brand transition-all" style={{ width: `${Math.round((status.active_job?.progress ?? 0) * 100)}%` }} />
        </div>
      ) : null}
    </section>
  );
}

export function InsightCard({ insight, lang, t }: { insight: InsightSummary; lang: Locale; t: Translate }) {
  return (
    <li>
      <Link
        href={href(lang, `/insights/${encodeURIComponent(insight.id)}`)}
        className="card group flex h-full flex-col gap-3 p-5 transition hover:border-line-strong hover:shadow-card"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            {translateDynamic(t, "categories", insight.category)}
          </span>
          <EvidenceBadge level={insight.evidence_level} grade={insight.evidence_grade} t={t} size="sm" showGrade={false} />
        </div>
        <h3 className="text-lg font-semibold leading-snug text-ink group-hover:text-brand-strong">{insight.title}</h3>
        <p dir="auto" className="line-clamp-3 text-sm text-ink-2">{insight.summary}</p>
        <div className="mt-auto flex items-center justify-between pt-1 text-xs text-ink-3">
          <span>{insight.n_sources === 1 ? t("common.source") : t("common.sources", { n: insight.n_sources })}</span>
          <span>{t("common.updated", { date: formatDate(lang, insight.updated_at) })}</span>
        </div>
      </Link>
    </li>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-2">
        <Icon name={icon} size={26} />
      </div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {body ? <p className="max-w-md text-ink-2">{body}</p> : null}
      {children}
    </div>
  );
}
