"use client";

import { ApiError, relativeTime, type QueueItem } from "@stepwell/shared";
import { useCallback, useEffect, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { useLocale, useT } from "@/lib/i18n-client";

import { StatTile } from "../charts";

/** Operator view: held and reported community posts, most urgent first (crisis → urgent → most reported). */
export function CommunityModeration() {
  const t = useT();
  const lang = useLocale();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [q, s] = await Promise.all([browserApi().admin.communityQueue(), browserApi().admin.communityStats()]);
      setQueue(q);
      setStats(s);
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
  const pause = async (item: QueueItem) => {
    if (item.member_id) await browserApi().admin.memberStatus(item.member_id, "suspended");
    await refresh();
  };

  return (
    <section aria-labelledby="moderation" className="space-y-4">
      <h2 id="moderation" className="text-lg font-semibold">
        {t("admin.moderationTitle")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t("admin.statMembers")} value={String(stats.members ?? 0)} />
        <StatTile label={t("admin.statPosts7d")} value={String(stats.posts_7d ?? 0)} />
        <StatTile label={t("admin.statHeld")} value={String(stats.posts_held ?? 0)} />
        <StatTile label={t("admin.statReports")} value={String(stats.open_reports ?? 0)} />
      </div>
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
