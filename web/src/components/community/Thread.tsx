"use client";

import { STORAGE_KEYS, type CommunityMeta, type ModerationOutcome, type Post, type PostThread, type Profile } from "@stepwell/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { communityError, isAuthError, useCommunityToken } from "@/lib/community";
import { useLocale, useT } from "@/lib/i18n-client";
import { readLocal } from "@/lib/storage";

import { ModerationNotice } from "./Composer";
import { PostCard } from "./PostCard";

export function CommunityThread({ id }: { id: string }) {
  const t = useT();
  const lang = useLocale();
  const [token, , loaded] = useCommunityToken();
  const [meta, setMeta] = useState<CommunityMeta | null>(null);
  const [thread, setThread] = useState<PostThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ModerationOutcome | null>(null);

  useEffect(() => {
    void browserApi().community.meta(lang).then(setMeta, () => undefined);
  }, [lang]);

  useEffect(() => {
    if (!token) return;
    browserApi()
      .community.thread(token, id)
      .then(setThread)
      .catch((e) => setError(isAuthError(e) ? null : e?.status === 404 ? t("common.notFound") : communityError(t, e)));
  }, [token, id, t]);

  if (!loaded) return <p className="text-ink-2">{t("common.loading")}</p>;
  if (!token)
    return (
      <p className="card p-5">
        <Link href={`/${lang}/community`} className="font-semibold text-brand hover:underline">
          {t("community.joinTitle")} →
        </Link>
      </p>
    );
  if (error) return <p className="card p-5 text-ink-2">{error}</p>;
  if (!thread || !meta) return <p className="text-ink-2">{t("common.loading")}</p>;

  const update = (post: Post) =>
    setThread((th) => (th ? (post.id === th.post.id ? { ...th, post } : { ...th, replies: th.replies.map((r) => (r.id === post.id ? post : r)) }) : th));

  const send = async () => {
    setBusy(true);
    try {
      const country = readLocal<Profile>(STORAGE_KEYS.profile, {}).country ?? null;
      const result = await browserApi().community.reply(token, id, { body, language: lang }, country);
      setThread((th) => (th ? { ...th, replies: [...th.replies, result.post], post: { ...th.post, reply_count: th.post.reply_count + (result.post.status === "published" ? 1 : 0) } } : th));
      setOutcome(result.moderation);
      setBody("");
      setError(null);
    } catch (e) {
      setOutcome(null);
      setError(communityError(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/${lang}/community`} className="text-sm font-semibold text-brand hover:underline">
        ← {t("community.title")}
      </Link>
      <PostCard post={thread.post} token={token} reactions={meta.reactions} onChange={update} onDeleted={() => window.history.back()} showThreadLink={false} />
      <ol className="space-y-3 border-l-2 border-line pl-3 md:pl-5" aria-label={t("community.replies", { n: thread.replies.length })}>
        {thread.replies.map((reply) => (
          <li key={reply.id}>
            <PostCard
              post={reply}
              token={token}
              reactions={meta.reactions}
              onChange={update}
              onDeleted={(rid) => setThread((th) => (th ? { ...th, replies: th.replies.filter((r) => r.id !== rid) } : th))}
              showThreadLink={false}
            />
          </li>
        ))}
      </ol>
      {thread.post.status === "published" ? (
        <form className="card space-y-3 p-4" onSubmit={(e) => (e.preventDefault(), void send())}>
          <textarea
            className="field min-h-24"
            value={body}
            maxLength={meta.limits.reply_chars ?? 1000}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("community.replyPlaceholder")}
            aria-label={t("community.replyPlaceholder")}
          />
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={busy || body.trim().length < 2}>
              {t("community.reply")}
            </button>
          </div>
        </form>
      ) : null}
      {outcome ? <ModerationNotice outcome={outcome} /> : null}
    </div>
  );
}
