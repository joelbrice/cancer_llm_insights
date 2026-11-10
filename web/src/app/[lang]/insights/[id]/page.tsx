import {
  formatDate,
  insightSpeech,
  sortedDesigns,
  splitCitations,
  translateDynamic,
  type Insight,
  type InsightPoint,
  type Translate,
} from "@stepwell/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { ApiDown, Disclaimer } from "@/components/blocks";
import { HBarChart, YearStrip } from "@/components/charts";
import { CitationCard, EvidenceBadge, EvidenceMeter } from "@/components/evidence";
import { AddQuestionButton, FeedbackButtons, PlanButton } from "@/components/InsightActions";
import { Icon, TextArrow } from "@/components/Icon";
import { ReadAloud } from "@/components/ReadAloud";
import { api, load } from "@/lib/api";
import { href, resolveLocale } from "@/lib/i18n";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const res = await load(() => api.insight(decodeURIComponent(id)));
  return res.data ? { title: res.data.title, description: res.data.summary.slice(0, 160) } : {};
}

function PointText({ point, t }: { point: InsightPoint; t: Translate }) {
  const flagged = point.label === "partial";
  return (
    <span dir="auto" className={flagged ? "claim-partial" : undefined} title={flagged ? t("ask.claimPartial") : undefined}>
      {point.text}
      {point.citations.map((n) => (
        <a key={n} href={`#ref-${n}`} className="cite" aria-label={`${t("ask.sources")} ${n}`}>
          {n}
        </a>
      ))}
      {flagged ? <span className="sr-only"> ({t("ask.claimPartial")})</span> : null}
    </span>
  );
}

function Summary({ text }: { text: string }) {
  return (
    <>
      {splitCitations(text).map((s, i) => (
        <Fragment key={i}>{s.text}</Fragment>
      ))}
    </>
  );
}

export default async function InsightPage({ params }: Props) {
  const { lang, t } = await resolveLocale(params);
  const { id } = await params;
  const res = await load(() => api.insight(decodeURIComponent(id)));
  if (res.error?.status === 404) notFound();
  if (!res.data) return <ApiDown t={t} />;
  const insight: Insight = res.data;
  const ev = insight.evidence;
  const designs = sortedDesigns(ev.design_breakdown).map((d) => ({
    id: d.id,
    label: translateDynamic(t, "designs", d.id),
    value: d.count,
  }));
  const years = insight.citations
    .filter((c) => c.source.year)
    .map((c) => ({
      id: `${c.n}`,
      year: c.source.year as number,
      label: c.source.title,
      detail: translateDynamic(t, "designs", c.source.source_type),
    }));

  return (
    <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-8">
        <header>
          <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-2">
            <Link href={href(lang, "/insights")} className="hover:underline">
              {t("insights.title")}
            </Link>{" "}
            / {translateDynamic(t, "categories", insight.category)}
          </nav>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">{insight.title}</h1>
          <p className="mt-3 flex items-start gap-2 text-ink-2">
            <Icon name="quote" size={18} className="mt-1 shrink-0" />
            <span>
              <span className="sr-only">{t("insights.question")}: </span>
              {insight.question}
            </span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <EvidenceBadge level={insight.evidence_level} grade={insight.evidence_grade} t={t} size="lg" />
            <span className="chip">{ev.n_sources === 1 ? t("common.source") : t("common.sources", { n: ev.n_sources })}</span>
            {insight.audience.map((a) => (
              <span key={a} className="chip">
                {t(`audiences.${a}`)}
              </span>
            ))}
            {insight.reviewed_at ? (
              <span className="chip">
                <Icon name="shield" size={14} />
                {t("insights.reviewed", { date: formatDate(lang, insight.reviewed_at) })}
              </span>
            ) : null}
          </div>
          {insight.status === "published" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <ReadAloud text={insightSpeech(insight, t)} lang={lang} />
              <AddQuestionButton title={insight.title} />
            </div>
          ) : null}
        </header>

        {insight.summary ? (
          <p dir="auto" className="text-lg leading-relaxed text-ink">
            <Summary text={insight.summary} />
          </p>
        ) : null}

        {insight.key_points.length ? (
          <section aria-labelledby="kp">
            <h2 id="kp" className="mb-3 text-xl font-semibold text-ink">
              {t("insights.keyPoints")}
            </h2>
            <ul className="space-y-3">
              {insight.key_points.map((point, i) => (
                <li key={i} className="card flex gap-3 p-4 leading-relaxed">
                  <Icon name="check" size={18} className="mt-1 shrink-0 text-brand" />
                  <PointText point={point} t={t} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {insight.recommendations.length ? (
          <section aria-labelledby="recs">
            <h2 id="recs" className="mb-3 text-xl font-semibold text-ink">
              {t("insights.recommendations")}
            </h2>
            <ul className="space-y-3">
              {insight.recommendations.map((point, i) => (
                <li key={i} className="card flex flex-col gap-3 p-4 leading-relaxed sm:flex-row sm:items-start">
                  <Icon name="target" size={18} className="mt-1 hidden shrink-0 text-brand sm:block" />
                  <div className="flex-1">
                    <PointText point={point} t={t} />
                  </div>
                  <PlanButton
                    item={{ insightId: insight.id, insightTitle: insight.title, text: point.text, evidenceLevel: insight.evidence_level }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {insight.limitations.length ? (
          <section aria-labelledby="lim" className="rounded-2xl border border-line bg-surface-2 p-5">
            <h2 id="lim" className="mb-2 flex items-center gap-2 font-semibold text-ink">
              <Icon name="info" size={18} />
              {t("insights.limitations")}
            </h2>
            <ul className="list-disc space-y-1 ps-5 text-ink-2">
              {insight.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="refs">
          <h2 id="refs" className="mb-3 text-xl font-semibold text-ink">
            {t("insights.sourcesTitle")}
          </h2>
          <ol className="space-y-3">
            {insight.citations.map((c) => (
              <CitationCard key={c.n} citation={c} t={t} />
            ))}
          </ol>
        </section>

        <footer className="space-y-4 border-t border-line pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FeedbackButtons insightId={insight.id} />
            <Link href={href(lang, `/ask?q=${encodeURIComponent(insight.question)}`)} className="btn btn-ghost">
              <Icon name="chat" size={18} />
              {t("insights.askFollowUp")}
            </Link>
          </div>
          <p className="text-xs text-ink-3">
            {t("insights.aiGenerated")}{" "}
            {t("insights.generated", { date: formatDate(lang, insight.generated_at), version: insight.version })} · {insight.model} · prompt{" "}
            {insight.prompt_version}
          </p>
          <Disclaimer t={t} />
        </footer>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-labelledby="profile">
        <section className="card space-y-5 p-5">
          <h2 id="profile" className="font-semibold text-ink">
            {t("insights.profile")}
          </h2>
          <div className="flex items-center gap-3">
            <EvidenceMeter level={insight.evidence_level} size="lg" />
            <div>
              <p className="text-lg font-semibold text-ink">{t(`levels.${insight.evidence_level}`)}</p>
              <p className="text-xs text-ink-2">{t("levels.gradeLabel", { grade: insight.evidence_grade })}</p>
            </div>
          </div>
          <p className="text-sm text-ink-2">{t(`levels.${insight.evidence_level}Desc`)}</p>
          <details className="group" open>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink">
              <Icon name="chevronDown" size={16} className="transition group-open:rotate-180" />
              {t("insights.whyGrade")}
            </summary>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-ink-2">
              {ev.rationale.map((r) => (
                <li key={r.code}>{r.text}</li>
              ))}
            </ul>
          </details>
          {designs.length ? <HBarChart data={designs} title={t("insights.designs")} /> : null}
          {years.length ? <YearStrip data={years} title={t("insights.timeline")} /> : null}
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Icon name={ev.consistency === "mixed" ? "alert" : "check"} size={16} />
            {t(`consistency.${ev.consistency}`)}
          </p>
          <Link href={href(lang, "/methodology")} className="text-sm font-semibold text-brand hover:underline">
            {t("nav.methodology")} <TextArrow />
          </Link>
        </section>
      </aside>
    </article>
  );
}
