"use client";

import {
  addCustomQuestion,
  APPOINTMENT_QUESTIONS,
  EMPTY_APPOINTMENT,
  formatQuestionList,
  moveQuestion,
  questionGroups,
  questionText,
  removeQuestion,
  setNote,
  STORAGE_KEYS,
  toggleQuestion,
  type AppointmentState,
  type MessageKey,
  type Profile,
  type QuestionGroupId,
} from "@stepwell/shared";
import { useState, type FormEvent } from "react";

import { useLocale, useT } from "@/lib/i18n-client";
import { useLocalState } from "@/lib/storage";

import { Icon } from "./Icon";

/** "Questions to bring to your appointment": curated per journey, plus the person's own; kept on this device. */
export function AppointmentBuilder() {
  const t = useT();
  const lang = useLocale();
  const [state, setState, loaded] = useLocalState<AppointmentState>(STORAGE_KEYS.appointment, EMPTY_APPOINTMENT);
  const [profile] = useLocalState<Profile>(STORAGE_KEYS.profile, {});
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const groups = questionGroups(profile.audience ?? null);
  const groupTitle = (g: QuestionGroupId) => (g === "general" ? t("appointment.general") : t(`audiences.${g}` as MessageKey));
  const list = state.selected.map((id) => ({ id, text: questionText(t, state, id) })).filter((q): q is { id: string; text: string } => !!q.text);
  const asText = () => formatQuestionList(t, state, new Date(), lang);

  const addOwn = (event: FormEvent) => {
    event.preventDefault();
    setState((prev) => addCustomQuestion(prev, draft));
    setDraft("");
  };
  const share = async () => {
    const text = asText();
    if (navigator.share) {
      try {
        await navigator.share({ title: t("appointment.listHeading"), text });
        return;
      } catch {
        /* cancelled: fall back to copying */
      }
    }
    await navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined);
  };

  if (!loaded) return <p className="text-ink-2">{t("common.loading")}</p>;

  return (
    <>
      <div className="no-print grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          {groups.map((group, index) => (
            <details key={group} className="card group p-0" open={index < 2}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-ink">
                <span>
                  {groupTitle(group)}
                  {index === 0 && profile.audience ? <span className="chip ms-2 align-middle">{t("appointment.suggested")}</span> : null}
                </span>
                <Icon name="chevronDown" size={18} className="shrink-0 transition group-open:rotate-180" />
              </summary>
              <ul className="space-y-1 px-2 pb-3">
                {APPOINTMENT_QUESTIONS[group].map((id) => {
                  const checked = state.selected.includes(id);
                  return (
                    <li key={id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-surface-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]"
                          checked={checked}
                          onChange={() => setState((prev) => toggleQuestion(prev, id))}
                        />
                        <span className="text-ink">{t(`appointment.q.${id}` as MessageKey)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-labelledby="my-list">
          <section className="card space-y-3 p-4">
            <h2 id="my-list" className="font-semibold text-ink">
              {t("appointment.yourList", { n: list.length })}
            </h2>
            {list.length ? (
              <ol className="space-y-3">
                {list.map((q, i) => (
                  <li key={q.id} className="space-y-2 rounded-xl bg-surface-2 p-3">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{i + 1}. </span>
                      {q.text}
                    </p>
                    <label className="block">
                      <span className="sr-only">
                        {t("appointment.notes")} — {q.text}
                      </span>
                      <textarea
                        className="field min-h-16 w-full text-sm"
                        placeholder={t("appointment.notesPlaceholder")}
                        value={state.notes[q.id] ?? ""}
                        maxLength={2000}
                        onChange={(e) => setState((prev) => setNote(prev, q.id, e.target.value))}
                      />
                    </label>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="btn btn-ghost !min-h-9 !px-2 text-xs" disabled={i === 0} onClick={() => setState((prev) => moveQuestion(prev, q.id, -1))} aria-label={`${t("appointment.moveUp")}: ${q.text}`}>
                        <Icon name="arrowUp" size={14} />
                      </button>
                      <button type="button" className="btn btn-ghost !min-h-9 !px-2 text-xs" disabled={i === list.length - 1} onClick={() => setState((prev) => moveQuestion(prev, q.id, 1))} aria-label={`${t("appointment.moveDown")}: ${q.text}`}>
                        <Icon name="arrowDown" size={14} />
                      </button>
                      <button type="button" className="btn btn-ghost !min-h-9 !px-2 text-xs" onClick={() => setState((prev) => removeQuestion(prev, q.id))} aria-label={`${t("appointment.remove")}: ${q.text}`}>
                        <Icon name="trash" size={14} />
                        {t("appointment.remove")}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-2">{t("appointment.emptyList")}</p>
            )}
            <form onSubmit={addOwn} className="space-y-2">
              <label htmlFor="own-question" className="block text-sm font-semibold text-ink">
                {t("appointment.addOwn")}
              </label>
              <div className="flex gap-2">
                <input
                  id="own-question"
                  className="field min-w-0 flex-1"
                  value={draft}
                  maxLength={300}
                  placeholder={t("appointment.addOwnPlaceholder")}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button type="submit" className="btn btn-primary shrink-0" disabled={draft.trim().length < 3}>
                  <Icon name="plus" size={16} />
                  {t("appointment.add")}
                </button>
              </div>
            </form>
            {list.length ? (
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <button type="button" className="btn btn-ghost !min-h-10 !px-3 text-sm" onClick={() => window.print()}>
                  <Icon name="printer" size={16} />
                  {t("appointment.print")}
                </button>
                <button type="button" className="btn btn-ghost !min-h-10 !px-3 text-sm" onClick={() => void share()}>
                  <Icon name={copied ? "check" : "share"} size={16} />
                  {copied ? t("appointment.copied") : t("appointment.share")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost !min-h-10 !px-3 text-sm"
                  onClick={() => window.confirm(t("appointment.clearConfirm")) && setState(EMPTY_APPOINTMENT)}
                >
                  <Icon name="trash" size={16} />
                  {t("appointment.clear")}
                </button>
              </div>
            ) : null}
            <p className="text-xs text-ink-3">{t("appointment.tip")}</p>
          </section>
        </aside>
      </div>

      <section className="print-only" aria-hidden="true">
        <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed">{asText()}</pre>
      </section>
    </>
  );
}
