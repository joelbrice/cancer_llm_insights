"use client";

import { relativeTime, type MessageKey, type ModeratedPost, type SafetyAssessment } from "@stepwell/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { browserApi } from "@/lib/browser-api";
import { communityError } from "@/lib/community";
import { useLocale, useT } from "@/lib/i18n-client";

import { SafetyBanner } from "../chat/AnswerCard";
import { Icon } from "../Icon";

const HELD = ["crisis", "emergency", "urgent", "medical_claim", "solicitation", "abuse", "reported", "new_member"];

/** The member's own held and removed posts: why, the decision, and a once-per-post request for review. */
export function MyModeration({ token, country }: { token: string; country?: string | null }) {
  const t = useT();
  const lang = useLocale();
  const [items, setItems] = useState<ModeratedPost[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [safety, setSafety] = useState<SafetyAssessment | null>(null);

  const refresh = useCallback(() => {
    void browserApi().community.myModeration(token).then(setItems, () => setItems([]));
  }, [token]);
  useEffect(refresh, [refresh]);

  if (!items) return null;

  const send = async (event: FormEvent, postId: string) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await browserApi().community.appeal(token, postId, text.trim(), country);
      setSafety(result.safety);
      setMessage(t("community.appealSent"));
      setOpen(null);
      setText("");
      refresh();
    } catch (e) {
      setMessage(communityError(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-3 p-4" aria-labelledby="my-moderation">
      <h2 id="my-moderation" className="font-semibold text-ink">
        {t("community.myModeration")}
      </h2>
      {safety ? <SafetyBanner safety={safety} /> : null}
      {!items.length ? <p className="text-sm text-ink-2">{t("community.myModerationEmpty")}</p> : null}
      <ul className="space-y-3">
        {items.map((item) => {
          const reason = item.reason && HELD.includes(item.reason) ? item.reason : "default";
          return (
            <li key={item.post.id} className="space-y-2 rounded-xl bg-surface-2 p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="chip">{item.post.status === "removed" ? t("community.removedByModerator") : t("community.heldForReview")}</span>
                <span className="text-xs text-ink-3">{relativeTime(lang, item.post.created_at)}</span>
              </p>
              <p dir="auto" className="line-clamp-4 whitespace-pre-wrap break-words text-ink">{item.post.body}</p>
              <p className="text-xs text-ink-2">{t("community.reasonLabel", { reason: t(`community.held.${reason}` as MessageKey) })}</p>
              {item.appeal ? (
                <div className="space-y-1 border-t border-line pt-2">
                  <p className="font-semibold text-ink">{t(`community.appealStatus.${item.appeal.status}`)}</p>
                  {item.appeal.response ? (
                    <p className="text-ink-2">
                      <span className="font-semibold">{t("community.appealResponse")}: </span>
                      {item.appeal.response}
                    </p>
                  ) : null}
                </div>
              ) : item.can_appeal ? (
                open === item.post.id ? (
                  <form onSubmit={(e) => void send(e, item.post.id)} className="space-y-2 border-t border-line pt-2">
                    <label htmlFor={`appeal-${item.post.id}`} className="block font-semibold text-ink">
                      {t("community.appealTitle")}
                    </label>
                    <p className="text-xs text-ink-2">{t("community.appealHelp")}</p>
                    <textarea
                      id={`appeal-${item.post.id}`}
                      className="field min-h-20 w-full"
                      value={text}
                      minLength={10}
                      maxLength={1000}
                      placeholder={t("community.appealPlaceholder")}
                      onChange={(e) => setText(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="btn btn-primary !min-h-9 text-sm" disabled={busy || text.trim().length < 10}>
                        {t("community.appealSend")}
                      </button>
                      <button type="button" className="btn btn-ghost !min-h-9 text-sm" onClick={() => setOpen(null)}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="btn btn-ghost !min-h-9 text-sm" onClick={() => (setOpen(item.post.id), setText(""), setMessage(null))}>
                    <Icon name="scale" size={16} />
                    {t("community.appeal")}
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      {message ? (
        <p role="status" className="text-sm text-ink-2">
          {message}
        </p>
      ) : null}
    </section>
  );
}
