"use client";

import {
  bmiOption,
  CHECK_ITEMS,
  evaluateCheck,
  FRAMEWORKS,
  STORAGE_KEYS,
  type CheckAnswers,
  type CheckStatus,
  type TopicStatus,
} from "@stepwell/shared";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { useLocale, useT } from "@/lib/i18n-client";
import { useLocalState } from "@/lib/storage";

import { Icon, type IconName } from "./Icon";

const STATUS_STYLE: Record<CheckStatus, { icon: IconName; color: string; key: "aligned" | "partly" | "notAligned" | "info" }> = {
  aligned: { icon: "check", color: "var(--good-ink)", key: "aligned" },
  partly: { icon: "alert", color: "var(--warning-ink)", key: "partly" },
  not_aligned: { icon: "target", color: "var(--critical)", key: "notAligned" },
  info: { icon: "info", color: "var(--ink-2)", key: "info" },
};

export function LifestyleCheck() {
  const t = useT();
  const lang = useLocale();
  const [answers, setAnswers, loaded] = useLocalState<CheckAnswers>(STORAGE_KEYS.check, {});
  const [step, setStep] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [topics, setTopics] = useState<Record<string, TopicStatus>>({});
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (loaded && Object.keys(answers).length >= CHECK_ITEMS.length) setShowResults(true);
    // run once after loading saved answers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    browserApi()
      .topics(lang)
      .then((list) => setTopics(Object.fromEntries(list.map((x) => [x.id, x]))))
      .catch(() => setTopics({}));
  }, [lang]);

  const result = useMemo(() => evaluateCheck(answers), [answers]);
  const item = CHECK_ITEMS[step]!;
  const total = CHECK_ITEMS.length;

  if (!loaded) return <p className="text-ink-2">{t("common.loading")}</p>;

  if (showResults) {
    return (
      <div className="space-y-6">
        <div className="card p-5">
          <h2 className="text-xl font-semibold">{t("check.resultTitle")}</h2>
          <p className="mt-1 text-ink-2">{t("check.summary", { aligned: result.counts.aligned, total: result.answered })}</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
            {(["aligned", "partly", "info", "not_aligned"] as CheckStatus[]).map((s) =>
              result.counts[s] ? (
                <span
                  key={s}
                  className="h-full border-r-2 border-[var(--surface)] last:border-r-0"
                  style={{ width: `${(result.counts[s] / Math.max(1, result.answered)) * 100}%`, background: STATUS_STYLE[s].color }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
            {(["aligned", "partly", "not_aligned", "info"] as CheckStatus[]).map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <Icon name={STATUS_STYLE[s].icon} size={14} style={{ color: STATUS_STYLE[s].color }} />
                {t(`check.${STATUS_STYLE[s].key}`)}: <span className="font-semibold text-ink">{result.counts[s]}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="flex gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink-2">
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />
          {t("check.notRiskScore")}
        </p>
        <ol className="space-y-3">
          {result.items.map(({ item: it, option, status }) => {
            const topic = topics[it.topicId];
            const style = STATUS_STYLE[status];
            return (
              <li key={it.id} className="card p-5">
                <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: style.color }}>
                  <Icon name={style.icon} size={16} />
                  {t(`check.${style.key}`)}
                </p>
                <h3 className="mt-1 font-semibold text-ink">{it.question[lang]}</h3>
                <p className="mt-0.5 text-sm text-ink-2">→ {option.label[lang]}</p>
                <p className="mt-3 text-ink">{it.advice[lang]}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-ink-3">{t("check.framework", { framework: FRAMEWORKS[it.framework] })}</span>
                  {topic?.status === "published" && topic.insight_id ? (
                    <Link href={`/${lang}/insights/${encodeURIComponent(topic.insight_id)}`} className="text-sm font-semibold text-brand hover:underline">
                      {t("check.seeEvidence")} →
                    </Link>
                  ) : (
                    <span className="chip">{t("insights.awaitingEvidence")}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setAnswers({});
            setStep(0);
            setShowResults(false);
          }}
        >
          <Icon name="refresh" size={18} />
          {t("check.restart")}
        </button>
      </div>
    );
  }

  const selected = answers[item.id];
  return (
    <div className="card p-5 md:p-8">
      <div className="mb-4 flex items-center justify-between text-sm text-ink-2">
        <span>{t("check.progress", { current: step + 1, total })}</span>
        <span className="tabular-nums">{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(step / total) * 100}%` }} />
      </div>
      <fieldset>
        <legend className="text-xl font-semibold leading-snug text-ink">{item.question[lang]}</legend>
        {item.id === "weight" ? (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-3">
            <div>
              <label className="label" htmlFor="h">
                cm
              </label>
              <input id="h" className="field" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" />
            </div>
            <div>
              <label className="label" htmlFor="w">
                kg
              </label>
              <input id="w" className="field" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="68" />
            </div>
            <button
              type="button"
              className="btn btn-ghost col-span-2"
              onClick={() => {
                const option = bmiOption(Number(height.replace(",", ".")), Number(weight.replace(",", ".")));
                if (option) setAnswers((prev) => ({ ...prev, weight: option }));
              }}
            >
              BMI
            </button>
          </div>
        ) : null}
        <div className="mt-5 grid gap-2">
          {item.options.map((option) => (
            <label
              key={option.id}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                selected === option.id ? "border-brand bg-brand-soft" : "border-line-strong hover:bg-surface-2"
              }`}
            >
              <input
                type="radio"
                name={item.id}
                value={option.id}
                checked={selected === option.id}
                onChange={() => setAnswers((prev) => ({ ...prev, [item.id]: option.id }))}
                className="h-5 w-5 accent-[var(--brand)]"
              />
              <span className="text-ink">{option.label[lang]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex items-center justify-between gap-2">
        <button type="button" className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          ← {t("check.back")}
        </button>
        {step < total - 1 ? (
          <button type="button" className="btn btn-primary" disabled={!selected} onClick={() => setStep((s) => s + 1)}>
            {t("check.next")} →
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!selected} onClick={() => setShowResults(true)}>
            {t("check.finish")}
          </button>
        )}
      </div>
    </div>
  );
}
