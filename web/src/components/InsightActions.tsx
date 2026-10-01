"use client";

import { addToPlan, planItemId, STORAGE_KEYS, type PlanItem } from "@stepwell/shared";
import { useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { useLocale, useT } from "@/lib/i18n-client";
import { useLocalState } from "@/lib/storage";

import { Icon } from "./Icon";

export function PlanButton({ item }: { item: Omit<PlanItem, "id" | "addedAt" | "checkins"> }) {
  const t = useT();
  const [plan, setPlan, loaded] = useLocalState<PlanItem[]>(STORAGE_KEYS.plan, []);
  const inPlan = plan.some((p) => p.id === planItemId(item.insightId, item.text));
  return (
    <button
      type="button"
      className={`btn shrink-0 !min-h-10 !px-3 text-sm ${inPlan ? "btn-ghost" : "btn-primary"}`}
      disabled={!loaded || inPlan}
      onClick={() => setPlan((prev) => addToPlan(prev, item))}
      aria-pressed={inPlan}
    >
      <Icon name={inPlan ? "check" : "plus"} size={16} />
      {inPlan ? t("insights.inPlan") : t("insights.addToPlan")}
    </button>
  );
}

export function FeedbackButtons({ insightId }: { insightId: string }) {
  const t = useT();
  const lang = useLocale();
  const [sent, setSent] = useState(false);
  const send = async (rating: 1 | -1) => {
    setSent(true);
    try {
      await browserApi().feedback({ target_type: "insight", target_id: insightId, rating, language: lang });
    } catch {
      /* best effort */
    }
  };
  if (sent) return <p className="text-sm text-ink-2">{t("ask.thanks")}</p>;
  return (
    <div className="flex gap-2">
      <button type="button" className="btn btn-ghost !min-h-10 !px-3 text-sm" onClick={() => void send(1)}>
        <Icon name="thumbUp" size={16} />
        {t("ask.helpful")}
      </button>
      <button type="button" className="btn btn-ghost !min-h-10 !px-3 text-sm" onClick={() => void send(-1)}>
        <Icon name="thumbDown" size={16} />
        {t("ask.notHelpful")}
      </button>
    </div>
  );
}
