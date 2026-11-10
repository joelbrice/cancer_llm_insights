"use client";

import {
  REACTION_EMOJI,
  relativeTime,
  type Post,
  type ReactionKind,
  type ReportReason,
} from "@stepwell/shared";
import Link from "next/link";
import { useRef, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { communityError } from "@/lib/community";
import { useLocale, useT } from "@/lib/i18n-client";

import { EvidenceBadge } from "../evidence";
import { Icon } from "../Icon";

const REASONS: ReportReason[] = ["harmful_medical", "crisis", "harassment", "spam", "privacy", "other"];

export function Avatar({ handle }: { handle: string | null }) {
  // Deterministic, non-identifying colour from the nickname.
  const hue = handle ? [...handle].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7) : 0;
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      style={{ background: handle ? `hsl(${hue} 45% 88%)` : "var(--surface-3)", color: handle ? `hsl(${hue} 55% 25%)` : "var(--ink-2)" }}
    >
      {handle ? handle.trim().charAt(0).toUpperCase() : "·"}
    </span>
  );
}

export function PostCard({
  post,
  token,
  reactions,
  onChange,
  onDeleted,
  onBlocked,
  showThreadLink = true,
}: {
  post: Post;
  token: string;
  reactions: ReactionKind[];
  onChange: (post: Post) => void;
  onDeleted: (id: string) => void;
  /** Called after the author was blocked: hide everything they wrote. */
  onBlocked?: (handle: string) => void;
  showThreadLink?: boolean;
}) {
  const t = useT();
  const lang = useLocale();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const reportDialog = useRef<HTMLDialogElement>(null);
  const mine = post.author?.is_me ?? false;
  const deleted = post.status === "deleted";

  const toggle = async (kind: ReactionKind) => {
    if (busy || mine || post.status !== "published") return;
    const on = !post.my_reactions.includes(kind);
    setBusy(true);
    try {
      const result = await browserApi().community.react(token, post.id, kind, on);
      onChange({ ...post, reactions: result.reactions, my_reactions: result.my_reactions });
    } catch (error) {
      setMessage(communityError(t, error));
    } finally {
      setBusy(false);
    }
  };

  const report = async (reason: ReportReason) => {
    reportDialog.current?.close();
    try {
      await browserApi().community.report(token, post.id, reason);
      setMessage(t("community.reportSent"));
    } catch (error) {
      setMessage(communityError(t, error));
    }
  };

  const block = async () => {
    if (!window.confirm(`${t("community.block")}?\n\n${t("community.blockConfirm")}`)) return;
    try {
      const result = await browserApi().community.blockAuthor(token, post.id);
      onBlocked?.(result.handle);
    } catch (error) {
      setMessage(communityError(t, error));
    }
  };

  const save = async () => {
    try {
      const result = await browserApi().community.edit(token, post.id, draft);
      onChange(result.post);
      setEditing(false);
      setMessage(result.moderation.status === "held" ? t("community.pending") : null);
    } catch (error) {
      setMessage(communityError(t, error));
    }
  };

  const remove = async () => {
    if (!window.confirm(t("community.deleteConfirm"))) return;
    try {
      await browserApi().community.remove(token, post.id);
      onDeleted(post.id);
    } catch (error) {
      setMessage(communityError(t, error));
    }
  };

  return (
    <article className={`card p-4 md:p-5 ${post.status === "held" ? "border-dashed" : ""}`} aria-labelledby={`p-${post.id}`}>
      <header className="flex items-start gap-3">
        <Avatar handle={post.author?.handle ?? null} />
        <div className="min-w-0 flex-1">
          <p id={`p-${post.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-semibold text-ink">
              {post.author ? (mine ? `${post.author.handle} (${t("community.you")})` : post.author.handle) : t("community.formerMember")}
            </span>
            {post.author?.journey ? <span className="chip !py-0.5 text-xs">{t(`audiences.${post.author.journey}`)}</span> : null}
          </p>
          <p className="text-xs text-ink-3">
            {post.kind !== "reply" ? `${t(`community.kinds.${post.kind}`)} · ` : ""}
            <time dateTime={post.created_at}>{relativeTime(lang, post.created_at)}</time>
            {post.edited_at ? ` · ${t("community.edited")}` : ""}
          </p>
        </div>
      </header>

      {post.status === "held" ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-ink">
          <Icon name="lock" size={16} className="shrink-0" />
          {t("community.pending")}
        </p>
      ) : null}

      {deleted ? (
        <p className="mt-3 italic text-ink-3">{t("community.deleted")}</p>
      ) : editing ? (
        <div className="mt-3 space-y-2">
          <textarea className="field min-h-28" value={draft} maxLength={post.parent_id ? 1000 : 2000} onChange={(e) => setDraft(e.target.value)} aria-label={t("community.edit")} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary !min-h-10" onClick={() => void save()} disabled={draft.trim().length < 2}>
              {t("common.save")}
            </button>
            <button type="button" className="btn btn-ghost !min-h-10" onClick={() => (setEditing(false), setDraft(post.body))}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <p dir="auto" className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-ink">{post.body}</p>
      )}

      {post.notes.includes("care_team") && !deleted ? (
        <p className="mt-3 flex gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink-2">
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />
          {t("community.careTeamNote")}
        </p>
      ) : null}

      {post.related_insight && !deleted ? (
        <Link
          href={`/${lang}/insights/${encodeURIComponent(post.related_insight.id)}`}
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface-2 p-3 text-sm transition hover:border-brand"
        >
          <span className="flex items-center gap-1.5 font-semibold text-brand">
            <Icon name="spark" size={16} />
            {t("community.researchSays")}
          </span>
          <span className="min-w-0 flex-1 text-ink">{post.related_insight.title}</span>
          <EvidenceBadge level={post.related_insight.evidence_level} grade="" t={t} size="sm" showGrade={false} />
        </Link>
      ) : null}

      {!deleted ? (
        <footer className="mt-4 flex flex-wrap items-center gap-2">
          {reactions.map((kind) => {
            const count = post.reactions[kind] ?? 0;
            const pressed = post.my_reactions.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                onClick={() => void toggle(kind)}
                disabled={mine || post.status !== "published"}
                aria-pressed={pressed}
                title={t(`community.reactions.${kind}`)}
                aria-label={`${t(`community.reactions.${kind}`)}${count ? ` (${count})` : ""}`}
                className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-sm transition disabled:cursor-default ${
                  pressed ? "border-brand bg-brand-soft text-ink" : "border-line text-ink-2 hover:bg-surface-2"
                }`}
              >
                <span aria-hidden="true">{REACTION_EMOJI[kind]}</span>
                {count ? <span className="tabular-nums">{count}</span> : null}
              </button>
            );
          })}
          <span className="ms-auto flex items-center gap-1">
            {showThreadLink && !post.parent_id && post.status === "published" ? (
              <Link href={`/${lang}/community/${encodeURIComponent(post.id)}`} className="btn btn-ghost !min-h-9 !px-3 text-sm">
                <Icon name="chat" size={16} />
                {post.reply_count === 1 ? t("community.oneReply") : post.reply_count ? t("community.replies", { n: post.reply_count }) : t("community.reply")}
              </Link>
            ) : null}
            {mine ? (
              <>
                <button type="button" className="btn btn-ghost !min-h-9 !px-2" onClick={() => setEditing(true)} aria-label={t("community.edit")}>
                  <Icon name="edit" size={16} />
                </button>
                <button type="button" className="btn btn-ghost !min-h-9 !px-2" onClick={() => void remove()} aria-label={t("community.delete")}>
                  <Icon name="trash" size={16} />
                </button>
              </>
            ) : post.status === "published" ? (
              <>
                <button type="button" className="btn btn-ghost !min-h-9 !px-2" onClick={() => reportDialog.current?.showModal()} aria-label={t("community.report")} title={t("community.report")}>
                  <Icon name="flag" size={16} />
                </button>
                {post.author ? (
                  <button type="button" className="btn btn-ghost !min-h-9 !px-2" onClick={() => void block()} aria-label={t("community.block")} title={t("community.block")}>
                    <Icon name="ban" size={16} />
                  </button>
                ) : null}
              </>
            ) : null}
          </span>
        </footer>
      ) : null}

      {message ? (
        <p role="status" className="mt-2 text-sm text-ink-2">
          {message}
        </p>
      ) : null}

      <dialog
        ref={reportDialog}
        className="m-auto w-[min(26rem,92vw)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/40"
        onClick={(e) => e.target === reportDialog.current && reportDialog.current?.close()}
        aria-label={t("community.reportTitle")}
      >
        <div className="p-5">
          <h2 className="font-semibold">{t("community.reportTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {REASONS.map((reason) => (
              <li key={reason}>
                <button type="button" className="btn btn-ghost w-full !justify-start" onClick={() => void report(reason)}>
                  {t(`community.reportReasons.${reason}`)}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => reportDialog.current?.close()}>
            {t("common.cancel")}
          </button>
        </div>
      </dialog>
    </article>
  );
}
