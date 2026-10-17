"use client";

import { AUDIENCES, suggestHandle, type Audience, type CommunityMeta } from "@stepwell/shared";
import Link from "next/link";
import { useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { communityError } from "@/lib/community";
import { useLocale, useT } from "@/lib/i18n-client";

import { Icon, TextArrow } from "../Icon";

export function JoinCommunity({ meta, onToken }: { meta: CommunityMeta; onToken: (token: string) => void }) {
  const t = useT();
  const lang = useLocale();
  const [handle, setHandle] = useState("");
  const [journey, setJourney] = useState<Audience | "">("");
  const [age, setAge] = useState(false);
  const [rules, setRules] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [key, setKey] = useState("");

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await browserApi().community.join({
        handle,
        language: lang,
        journey: journey || null,
        accept_guidelines: rules,
        confirm_age: age,
        consent_health_data: consent,
      });
      onToken(session.token);
    } catch (e) {
      setError(communityError(t, e));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      await browserApi().community.me(key.trim());
      onToken(key.trim());
    } catch {
      setError(t("community.invalidKey"));
    } finally {
      setBusy(false);
    }
  };

  const check = (checked: boolean, set: (v: boolean) => void, label: string) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm leading-snug">
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" checked={checked} onChange={(e) => set(e.target.checked)} />
      <span>{label}</span>
    </label>
  );

  return (
    <section className="card p-5 md:p-8" aria-labelledby="join">
      <h2 id="join" className="text-xl font-semibold text-ink">
        {t("community.joinTitle")}
      </h2>
      <p className="mt-1 text-ink-2">{t("community.joinIntro")}</p>

      {restoring ? (
        <form className="mt-5 space-y-3" onSubmit={(e) => (e.preventDefault(), void restore())}>
          <label className="label" htmlFor="c-key">
            {t("community.accessKey")}
          </label>
          <input id="c-key" className="field font-mono" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy || key.trim().length < 20}>
              <Icon name="key" size={18} />
              {t("community.restore")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => (setRestoring(false), setError(null))}>
              {t("common.back")}
            </button>
          </div>
        </form>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={(e) => (e.preventDefault(), void join())}>
          <div>
            <label className="label" htmlFor="c-handle">
              {t("community.handle")}
            </label>
            <div className="flex gap-2">
              <input
                id="c-handle"
                className="field"
                value={handle}
                maxLength={24}
                onChange={(e) => setHandle(e.target.value)}
                autoComplete="off"
                aria-describedby="c-handle-help"
              />
              <button type="button" className="btn btn-ghost shrink-0" onClick={() => setHandle(suggestHandle(lang))} aria-label={t("community.suggest")}>
                <Icon name="refresh" size={18} />
                <span className="hidden sm:inline">{t("community.suggest")}</span>
              </button>
            </div>
            <p id="c-handle-help" className="mt-1 text-xs text-ink-3">
              {t("community.handleHelp")}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="c-journey">
              {t("community.journey")}
            </label>
            <select id="c-journey" className="field" value={journey} onChange={(e) => setJourney(e.target.value as Audience | "")}>
              <option value="">{t("community.journeyNone")}</option>
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {t(`audiences.${a}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {check(age, setAge, t("community.confirmAge", { age: meta.min_age }))}
            {check(rules, setRules, t("community.acceptGuidelines"))}
            {check(consent, setConsent, t("community.consentHealth"))}
          </div>
          <p className="text-sm">
            <Link href={`/${lang}/community/guidelines`} className="font-semibold text-brand hover:underline">
              {t("community.guidelinesTitle")} <TextArrow />
            </Link>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy || handle.trim().length < 3 || !(age && rules && consent)}>
              {t("community.join")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => (setRestoring(true), setError(null))}>
              <Icon name="key" size={18} />
              {t("community.haveKey")}
            </button>
          </div>
        </form>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-critical">
          {error}
        </p>
      ) : null}
    </section>
  );
}
