"use client";

import { STORAGE_KEYS, type SurveyAnswer } from "@stepwell/shared";
import { useEffect, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { useT } from "@/lib/i18n-client";
import { useLocalState } from "@/lib/storage";

const ANSWERS: SurveyAnswer[] = ["yes", "somewhat", "no"];
const SNOOZE_DAYS = 30;

/** "Did you feel supported here this month?" — optional, at most monthly, counted only in anonymous totals. */
export function SurveyCard({ token }: { token: string }) {
  const t = useT();
  const [snoozedUntil, setSnoozedUntil, loaded] = useLocalState<string | null>(STORAGE_KEYS.surveySnooze, null);
  const [due, setDue] = useState(false);
  const [thanks, setThanks] = useState(false);
  const snoozed = !!snoozedUntil && new Date(snoozedUntil).getTime() > Date.now();

  useEffect(() => {
    if (!loaded || snoozed) return;
    let alive = true;
    void browserApi().community.survey(token).then((s) => alive && setDue(s.due), () => undefined);
    return () => {
      alive = false;
    };
  }, [loaded, snoozed, token]);

  if (thanks) {
    return (
      <p role="status" className="rounded-xl bg-brand-soft p-3 text-sm text-ink">
        {t("community.surveyThanks")}
      </p>
    );
  }
  if (!due || snoozed) return null;

  const answer = async (value: SurveyAnswer) => {
    setThanks(true);
    try {
      await browserApi().community.answerSurvey(token, value);
    } catch {
      /* best effort: never nag after an answer */
    }
  };
  const later = () => {
    setSnoozedUntil(new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString());
    setDue(false);
  };

  return (
    <section className="card space-y-3 p-4" aria-labelledby="survey">
      <h2 id="survey" className="font-semibold text-ink">
        {t("community.surveyTitle")}
      </h2>
      <p className="text-sm text-ink-2">{t("community.surveyHelp")}</p>
      <div className="flex flex-wrap gap-2">
        {ANSWERS.map((value) => (
          <button key={value} type="button" className="btn btn-ghost !min-h-10" onClick={() => void answer(value)}>
            {t(`community.survey.${value}`)}
          </button>
        ))}
        <button type="button" className="btn btn-ghost !min-h-10 text-ink-2" onClick={later}>
          {t("community.surveyLater")}
        </button>
      </div>
    </section>
  );
}
