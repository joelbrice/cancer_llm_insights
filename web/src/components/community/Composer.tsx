"use client";

import { POST_KINDS, type CircleInfo, type ModerationOutcome, type Post, type PostKind, type Profile, STORAGE_KEYS } from "@stepwell/shared";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { communityError } from "@/lib/community";
import { useLocale, useT } from "@/lib/i18n-client";
import { readLocal } from "@/lib/storage";

import { SafetyBanner } from "../chat/AnswerCard";

export interface ComposerHandle {
  focus: (kind?: PostKind) => void;
}

export function ModerationNotice({ outcome }: { outcome: ModerationOutcome }) {
  const t = useT();
  if (outcome.status !== "held") return null;
  const reason = outcome.reason ?? "default";
  const known = ["crisis", "emergency", "urgent", "medical_claim", "solicitation", "abuse", "reported", "new_member"].includes(reason);
  return (
    <div className="space-y-3" role="status">
      {outcome.safety ? <SafetyBanner safety={outcome.safety} /> : null}
      <div className="rounded-2xl border border-line bg-surface-2 p-4">
        <p className="font-semibold text-ink">{t("community.heldTitle")}</p>
        <p className="mt-1 text-sm text-ink-2">{t(`community.held.${known ? (reason as "crisis") : "default"}`)}</p>
      </div>
    </div>
  );
}

export const Composer = forwardRef<ComposerHandle, { token: string; circles: CircleInfo[]; circle: string | null; onPosted: (post: Post, outcome: ModerationOutcome) => void; limit: number }>(
  function Composer({ token, circles, circle, onPosted, limit }, ref) {
    const t = useT();
    const lang = useLocale();
    const [kind, setKind] = useState<PostKind>("win");
    const [target, setTarget] = useState<string>(circle ?? circles[0]?.id ?? "prevention");
    const [body, setBody] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const area = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: (k) => {
        if (k) setKind(k);
        area.current?.focus();
        area.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
    }));

    const effective = circle ?? target;
    const submit = async () => {
      setBusy(true);
      setError(null);
      try {
        const country = readLocal<Profile>(STORAGE_KEYS.profile, {}).country ?? null;
        const result = await browserApi().community.post(token, { circle: effective, kind, body, language: lang }, country);
        setBody("");
        onPosted(result.post, result.moderation);
      } catch (e) {
        setError(communityError(t, e));
      } finally {
        setBusy(false);
      }
    };

    return (
      <form className="card space-y-3 p-4 md:p-5" onSubmit={(e) => (e.preventDefault(), void submit())} aria-label={t("community.composerTitle")}>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("community.kind")}>
          {POST_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`chip ${kind === k ? "!border-brand !bg-brand-soft !text-ink" : ""}`}
            >
              {t(`community.kinds.${k}`)}
            </button>
          ))}
          {!circle ? (
            <select className="field !min-h-9 ml-auto w-auto !py-1 text-sm" value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t("community.circle")}>
              {circles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <textarea
          ref={area}
          className="field min-h-28 resize-y"
          value={body}
          maxLength={limit}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("community.composerPlaceholder")}
          aria-label={t("community.composerPlaceholder")}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs tabular-nums text-ink-3">
            {body.length}/{limit}
          </span>
          <button type="submit" className="btn btn-primary" disabled={busy || body.trim().length < 2}>
            {t("community.post")}
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-critical">
            {error}
          </p>
        ) : null}
      </form>
    );
  },
);
