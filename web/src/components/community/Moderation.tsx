"use client";

import { ApiError, relativeTime, type AppealQueueItem, type CommunityStats, type QueueItem } from "@stepwell/shared";
import { useCallback, useEffect, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { useLocale, useT } from "@/lib/i18n-client";

import { StatTile } from "../charts";

/** Operator view: held and reported community posts, most urgent first (crisis → urgent → most reported). */
export function CommunityModeration() {
  const t = useT();
  const lang = useLocale();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [appeals, setAppeals] = useState<AppealQueueItem[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [q, s, a] = await Promise.all([
        browserApi().admin.communityQueue(),
        browserApi().admin.communityStats(),
        browserApi().admin.appeals().catch(() => [] as AppealQueueItem[]),
      ]);
      setQueue(q);
      setStats(s);
      setAppeals(a);
      setError(null);
    } catch (e) {
      setQueue(null);
      if (!(e instanceof ApiError && (e.isUnauthorized || e.status === 404))) setError(t("common.error"));
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!queue || !stats) return error ? <p className="text-sm text-critical">{error}</p> : null;

  const act = async (item: QueueItem, action: "approve" | "remove") => {
    await browserApi().admin.moderate(item.post.id, action);
    await refresh();
  };
  const decideAppeal = async (item: AppealQueueItem, action: "uphold" | "overturn") => {
    await browserApi().admin.decideAppeal(item.appeal.id, action, responses[item.appeal.id]?.trim() || undefined);
    await refresh();
  };
  const health = stats.health;
  const share = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)} %`);
  const pause = async (item: QueueItem) => {
    if (item.member_id) await browserApi().admin.memberStatus(item.member_id, "suspended");
    await refresh();
  };

  return (
    <section aria-labelledby="moderation" className="space-y-4">
      <h2 id="moderation" className="text-lg font-semibold">
        {t("admin.moderationTitle")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label={t("admin.statMembers")} value={String(stats.members ?? 0)} />
        <StatTile label={t("admin.statPosts7d")} value={String(stats.posts_7d ?? 0)} />
        <StatTile label={t("admin.statHeld")} value={String(stats.posts_held ?? 0)} />
        <StatTile label={t("admin.statReports")} value={String(stats.open_reports ?? 0)} />
        <StatTile label={t("admin.statAppeals")} value={String(stats.open_appeals ?? 0)} />
      </div>
      {health ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-2">{t("admin.healthTitle", { days: health.window_days })}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatTile label={t("admin.answered24h")} value={share(health.answered_within_24h)} />
            <StatTile label={t("admin.heldShare")} value={share(health.held_share)} />
            <StatTile label={t("admin.reportsPer100")} value={health.reports_per_100_posts === null ? "—" : String(health.reports_per_100_posts)} />
            <StatTile label={t("admin.medianDecision")} value={health.median_hours_to_decision === null ? "—" : String(health.median_hours_to_decision)} />
            <StatTile
              label={t("admin.feltSupported")}
              value={share(stats.felt_supported_90d?.yes)}
              detail={stats.felt_supported_90d ? `n = ${stats.felt_supported_90d.responses}` : undefined}
            />
          </div>
        </div>
      ) : null}
      <section aria-labelledby="appeals" className="space-y-3">
        <h3 id="appeals" className="font-semibold text-ink">
          {t("admin.appealsTitle")}
        </h3>
        {!appeals.length ? (
          <p className="card p-5 text-ink-2">{t("admin.appealsEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {appeals.map((item) => (
              <li key={item.appeal.id} className={`card space-y-2 p-4 ${item.priority >= 2 ? "border-critical" : ""}`}>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {item.priority >= 1 ? <span className="chip !border-critical !text-critical">{t("admin.urgentReview")}</span> : null}
                  <span className="font-semibold">{item.post.author?.handle ?? t("community.formerMember")}</span>
                  <span className="text-ink-3">
                    {t("admin.appealedDecision", { status: item.appeal.post_status })} · {item.moderation.auto ?? "—"} ·{" "}
                    {relativeTime(lang, item.appeal.created_at)}
                  </span>
                </p>
                <p className="whitespace-pre-wrap break-words text-ink">{item.post.body}</p>
                <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink">
                  <span className="font-semibold">{t("admin.appealText")}: </span>
                  {item.appeal.text}
                </p>
                <label className="block">
                  <span className="sr-only">{t("admin.responsePlaceholder")}</span>
                  <textarea
                    className="field min-h-16 w-full text-sm"
                    placeholder={t("admin.responsePlaceholder")}
                    maxLength={1000}
                    value={responses[item.appeal.id] ?? ""}
                    onChange={(e) => setResponses((r) => ({ ...r, [item.appeal.id]: e.target.value }))}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary !min-h-9 text-sm" onClick={() => void decideAppeal(item, "overturn")}>
                    {t("admin.overturn")}
                  </button>
                  <button type="button" className="btn btn-ghost !min-h-9 text-sm" onClick={() => void decideAppeal(item, "uphold")}>
                    {t("admin.uphold")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {!queue.length ? (
        <p className="card p-5 text-ink-2">{t("admin.moderationEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {queue.map((item) => (
            <li key={item.post.id} className={`card space-y-2 p-4 ${(item.moderation.priority ?? 0) >= 2 ? "border-critical" : ""}`}>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                {(item.moderation.priority ?? 0) >= 1 ? <span className="chip !border-critical !text-critical">{t("admin.urgentReview")}</span> : null}
                <span className="font-semibold">{item.post.author?.handle ?? t("community.formerMember")}</span>
                <span className="text-ink-3">
                  {item.post.circle} · {relativeTime(lang, item.post.created_at)} · {item.post.status}
                </span>
              </p>
              <p className="whitespace-pre-wrap break-words text-ink">{item.post.body}</p>
              <p className="text-xs text-ink-2">
                {t("admin.flags")}: {item.flags.join(", ") || "—"}
                {item.reports.length ? ` · ${t("admin.reports")}: ${item.reports.map((r) => r.reason).join(", ")}` : ""}
              </p>
              {item.appeal ? (
                <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink">
                  <span className="font-semibold">{t("admin.appealText")}: </span>
                  {item.appeal.text}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary !min-h-9 text-sm" onClick={() => void act(item, "approve")}>
                  {t("admin.approve")}
                </button>
                <button type="button" className="btn btn-ghost !min-h-9 text-sm" onClick={() => void act(item, "remove")}>
                  {t("admin.remove")}
                </button>
                {item.member_id ? (
                  <button type="button" className="btn btn-ghost !min-h-9 text-sm" onClick={() => void pause(item)}>
                    {t("admin.pauseMember")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
