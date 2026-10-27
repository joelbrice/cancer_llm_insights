"use client";

import { isoWeek, removeFromPlan, STORAGE_KEYS, streak, toggleCheckin, type PlanItem, type Profile } from "@stepwell/shared";
import Link from "next/link";
import { useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { communityError, useCommunityToken } from "@/lib/community";

import { useLocale, useT } from "@/lib/i18n-client";
import { readLocal, useLocalState } from "@/lib/storage";

import { EvidenceBadge } from "./evidence";
import { Icon } from "./Icon";

export function PlanView() {
  const t = useT();
  const lang = useLocale();
  const [plan, setPlan, loaded] = useLocalState<PlanItem[]>(STORAGE_KEYS.plan, []);
  const [token] = useCommunityToken();
  const [shared, setShared] = useState<Record<string, string>>({});
  const week = isoWeek();

  /** Celebrate a streak with the community (a "milestone" post in the member's journey circle). */
  const share = async (item: PlanItem, weeks: number) => {
    if (!token) return;
    const profile = readLocal<Profile>(STORAGE_KEYS.profile, {});
    try {
      await browserApi().community.post(token, {
        circle: profile.audience ?? "prevention",
        kind: "milestone",
        body: t("community.milestoneText", { n: weeks, text: item.text }),
        language: lang,
      }, profile.country ?? null);
      setShared((s) => ({ ...s, [item.id]: t("community.milestoneShared") }));
    } catch (error) {
      setShared((s) => ({ ...s, [item.id]: communityError(t, error) }));
    }
  };
  if (!loaded) return <p className="text-ink-2">{t("common.loading")}</p>;
  if (!plan.length) {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-2">
          <Icon name="target" size={26} />
        </span>
        <p className="max-w-md text-ink-2">{t("plan.empty")}</p>
        <Link href={`/${lang}/insights`} className="btn btn-primary">
          {t("nav.insights")}
        </Link>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {plan.map((item) => {
        const done = item.checkins.includes(week);
        const weeks = streak(item, week);
        return (
          <li key={item.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
            <label className="flex flex-1 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-6 w-6 shrink-0 accent-[var(--brand)]"
                checked={done}
                onChange={() => setPlan((prev) => toggleCheckin(prev, item.id, week))}
                aria-describedby={`${item.id}-meta`}
              />
              <span>
                <span className={`block text-ink ${done ? "line-through decoration-[var(--brand)] decoration-2" : ""}`}>{item.text}</span>
                <span id={`${item.id}-meta`} className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                  <span>{t("plan.doneThisWeek")}</span>
                  {weeks ? <span className="chip">{t("plan.streak", { n: weeks })}</span> : null}
                </span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
              <EvidenceBadge level={item.evidenceLevel} grade="" t={t} size="sm" showGrade={false} />
              <Link href={`/${lang}/insights/${encodeURIComponent(item.insightId)}`} className="text-xs text-brand hover:underline">
                {t("plan.fromInsight", { title: item.insightTitle })}
              </Link>
              {token && weeks > 0 && !shared[item.id] ? (
                <button type="button" className="btn btn-ghost !min-h-9 !px-3 text-sm" onClick={() => void share(item, weeks)}>
                  <Icon name="users" size={16} />
                  {t("community.shareMilestone")}
                </button>
              ) : shared[item.id] ? (
                <span role="status" className="text-xs text-ink-2">
                  {shared[item.id]}
                </span>
              ) : null}
              <button type="button" className="btn btn-ghost !min-h-9 !px-3 text-sm" onClick={() => setPlan((prev) => removeFromPlan(prev, item.id))}>
                <Icon name="trash" size={16} />
                {t("plan.remove")}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
