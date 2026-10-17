"use client";

import { ApiError, formatDate, type InsightReviewItem, type InsightReviewState } from "@stepwell/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { useLocale, useT } from "@/lib/i18n-client";

import { EvidenceBadge } from "./evidence";

const STATES: InsightReviewState[] = ["pending", "unreviewed", "rejected", "withdrawn"];
const REVIEWER_KEY = "stepwell.reviewer";

/** Clinical review: approve or refuse rebuilt drafts (INSIGHT_REVIEW_REQUIRED), sign off, withdraw or restore. */
export function InsightReview() {
  const t = useT();
  const lang = useLocale();
  const [state, setState] = useState<InsightReviewState>("pending");
  const [items, setItems] = useState<InsightReviewItem[] | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setReviewer(window.sessionStorage.getItem(REVIEWER_KEY) ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setItems(await browserApi().admin.insightReviews(state));
      setError(null);
    } catch (e) {
      setItems(null);
      if (!(e instanceof ApiError && (e.isUnauthorized || e.status === 503))) setError(t("common.error"));
    }
  }, [state, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!items) return error ? <p className="text-sm text-critical">{error}</p> : null;

  const decide = async (item: InsightReviewItem, decision: "approved" | "rejected") => {
    if (reviewer.trim().length < 2) {
      setError(t("admin.reviewerRequired"));
      return;
    }
    try {
      window.sessionStorage.setItem(REVIEWER_KEY, reviewer.trim());
    } catch {
      /* ignore */
    }
    await browserApi().admin.reviewInsight(item.insight.id, decision, reviewer.trim(), notes[item.insight.id]?.trim() || undefined);
    setError(null);
    await refresh();
  };

  const labels: Record<InsightReviewState, [string, string]> = {
    pending: [t("admin.approveInsight"), t("admin.rejectInsight")],
    rejected: [t("admin.approveInsight"), t("admin.rejectInsight")],
    unreviewed: [t("admin.signOff"), t("admin.withdrawInsight")],
    withdrawn: [t("admin.restoreInsight"), t("admin.withdrawInsight")],
  };

  return (
    <section aria-labelledby="review" className="space-y-4">
      <h2 id="review" className="text-lg font-semibold">
        {t("admin.reviewTitle")}
      </h2>
      <p className="max-w-3xl text-sm text-ink-2">{t("admin.reviewHelp")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("admin.reviewTitle")}>
          {STATES.map((s) => (
            <button key={s} type="button" className={`chip ${state === s ? "!border-brand !bg-brand-soft !text-ink" : ""}`} aria-pressed={state === s} onClick={() => setState(s)}>
              {t(`admin.reviewStates.${s}`)}
            </button>
          ))}
        </div>
        <label className="min-w-64 flex-1 space-y-1 text-sm">
          <span className="block font-semibold text-ink">{t("admin.reviewer")}</span>
          <input className="field w-full" value={reviewer} maxLength={120} onChange={(e) => setReviewer(e.target.value)} />
        </label>
      </div>
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      {!items.length ? (
        <p className="card p-5 text-ink-2">{t("admin.reviewEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const [yes, no] = labels[state];
            const insight = item.insight;
            return (
              <li key={insight.id} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <EvidenceBadge level={insight.evidence_level} grade={insight.evidence_grade} t={t} size="sm" />
                  <span className="text-ink-3">
                    {insight.id} · v{insight.version} · {formatDate(lang, item.submitted_at)}
                  </span>
                  {state === "pending" ? (
                    <span className="chip">{item.has_public_version ? t("admin.replacesPublic") : t("admin.notYetPublic")}</span>
                  ) : null}
                </div>
                <h3 className="font-semibold text-ink">
                  {state === "unreviewed" ? (
                    <Link href={`/${lang}/insights/${encodeURIComponent(insight.id)}`} className="hover:underline">
                      {insight.title}
                    </Link>
                  ) : (
                    insight.title
                  )}
                </h3>
                <p className="text-sm text-ink-2">{insight.summary}</p>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-ink">
                    {t("insights.keyPoints")} · {t("insights.recommendations")} · {t("insights.sourcesTitle")} ({insight.citations.length})
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-ink">
                    {[...insight.key_points, ...insight.recommendations].map((p, i) => (
                      <li key={i}>
                        {p.text} <span className="text-ink-3">[{p.citations.join(", ")}]</span>
                      </li>
                    ))}
                  </ul>
                  <ol className="mt-2 list-decimal space-y-1 ps-5 text-xs text-ink-2">
                    {insight.citations.map((c) => (
                      <li key={c.n}>
                        {c.source.title} ({c.source.year ?? "n.d."}) — “{c.quote}”
                      </li>
                    ))}
                  </ol>
                </details>
                <label className="block">
                  <span className="sr-only">{t("admin.reviewNote")}</span>
                  <textarea
                    className="field min-h-14 w-full text-sm"
                    placeholder={t("admin.reviewNote")}
                    maxLength={2000}
                    value={notes[insight.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [insight.id]: e.target.value }))}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary !min-h-9 text-sm" onClick={() => void decide(item, "approved")}>
                    {yes}
                  </button>
                  {state !== "withdrawn" ? (
                    <button type="button" className="btn btn-ghost !min-h-9 text-sm" onClick={() => void decide(item, "rejected")}>
                      {no}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
