"use client";

import type { CommunityMeta, MemberMe, ModerationOutcome, Post } from "@stepwell/shared";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { communityError, isAuthError, useCommunityToken } from "@/lib/community";
import { useLocale, useT } from "@/lib/i18n-client";

import { Icon, type IconName } from "../Icon";
import { AccountPanel } from "./Account";
import { Composer, ModerationNotice, type ComposerHandle } from "./Composer";
import { JoinCommunity } from "./Join";
import { PostCard } from "./PostCard";

export const CIRCLE_ICON: Record<string, IconName> = { leaf: "leaf", heart: "heart", sunrise: "sunrise", people: "users" };

function Activity({ me, token, onSeen }: { me: MemberMe; token: string; onSeen: () => void }) {
  const t = useT();
  const lang = useLocale();
  const { new_replies, new_reactions, recent } = me.activity;
  const fresh = new_replies + new_reactions > 0;
  return (
    <section className="card p-4" aria-labelledby="activity">
      <div className="flex items-center justify-between gap-2">
        <h2 id="activity" className="font-semibold text-ink">
          {t("community.activity")}
        </h2>
        {fresh ? (
          <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => void browserApi().community.markSeen(token).then(onSeen)}>
            {t("community.markSeen")}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-ink-2">
        {fresh ? t("community.newActivity", { replies: new_replies, reactions: new_reactions }) : t("community.noActivity")}
      </p>
      {recent.length ? (
        <ul className="mt-2 space-y-1">
          {recent.slice(0, 5).map((item, i) => (
            <li key={`${item.post_id}-${item.type}-${i}`}>
              <Link href={`/${lang}/community/${encodeURIComponent(item.root_id)}`} className="block truncate rounded-lg px-2 py-1 text-sm text-ink-2 hover:bg-surface-2">
                {item.type === "reply" ? t("community.repliedToYou", { name: item.by }) : t("community.reactedToYou", { name: item.by })}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function CommunityApp() {
  const t = useT();
  const lang = useLocale();
  const [token, setToken, loaded] = useCommunityToken();
  const [meta, setMeta] = useState<CommunityMeta | null>(null);
  const [me, setMe] = useState<MemberMe | null>(null);
  const [circle, setCircle] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ModerationOutcome | null>(null);
  const composer = useRef<ComposerHandle>(null);

  useEffect(() => {
    browserApi()
      .community.meta(lang)
      .then(setMeta)
      .catch(() => setError(t("community.unavailable")));
  }, [lang, t]);

  const signOut = useCallback(
    (message?: string) => {
      setToken(null);
      setMe(null);
      setPosts([]);
      setNotice(message ?? null);
    },
    [setToken],
  );

  const refreshMe = useCallback(() => {
    if (!token) return;
    browserApi()
      .community.me(token)
      .then(setMe)
      .catch((e) => (isAuthError(e) ? signOut() : undefined));
  }, [token, signOut]);

  useEffect(refreshMe, [refreshMe]);

  const load = useCallback(
    async (reset: boolean) => {
      if (!token) return;
      setLoading(true);
      try {
        const page = await browserApi().community.feed(token, { circle: circle ?? undefined, cursor: reset ? null : cursor, limit: 15 });
        setPosts((prev) => (reset ? page.items : [...prev, ...page.items]));
        setCursor(page.next_cursor);
        setError(null);
      } catch (e) {
        if (isAuthError(e)) signOut();
        else setError(communityError(t, e));
      } finally {
        setLoading(false);
      }
    },
    [token, circle, cursor, signOut, t],
  );

  useEffect(() => {
    void load(true);
    // reload when the circle or account changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, circle]);

  if (!loaded || (!meta && !error)) return <p className="text-ink-2">{t("common.loading")}</p>;
  if (!meta) return <p className="card p-5 text-ink-2">{error}</p>;

  const current = meta.circles.find((c) => c.id === circle) ?? null;
  const update = (post: Post) => setPosts((list) => list.map((p) => (p.id === post.id ? post : p)));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-4">
        {notice ? (
          <p role="status" className="rounded-xl bg-brand-soft p-3 text-sm text-ink">
            {notice}
          </p>
        ) : null}

        <nav aria-label={t("community.circle")} className="-mx-4 overflow-x-auto px-4 lg:hidden">
          <div className="flex gap-2 pb-1">
            <button type="button" className={`chip shrink-0 ${!circle ? "!border-brand !bg-brand-soft !text-ink" : ""}`} onClick={() => setCircle(null)} aria-pressed={!circle}>
              {t("community.allCircles")}
            </button>
            {meta.circles.map((c) => (
              <button key={c.id} type="button" className={`chip shrink-0 ${circle === c.id ? "!border-brand !bg-brand-soft !text-ink" : ""}`} onClick={() => setCircle(c.id)} aria-pressed={circle === c.id}>
                {c.title}
              </button>
            ))}
          </div>
        </nav>

        {!token ? (
          <>
            <JoinCommunity meta={meta} onToken={(tok) => (setToken(tok), setNotice(null))} />
            <ul className="grid gap-3 sm:grid-cols-2">
              {meta.circles.map((c) => (
                <li key={c.id} className="card flex gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon name={CIRCLE_ICON[c.icon] ?? "users"} />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{c.title}</span>
                    <span className="block text-sm text-ink-2">{c.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {current ? (
              <section className="rounded-2xl border border-line bg-brand-soft p-4 md:p-5" aria-labelledby="prompt">
                <p className="text-sm text-ink-2">{current.description}</p>
                <p id="prompt" className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-strong">
                  {t("community.promptOfWeek")}
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">{current.prompt}</p>
                <button type="button" className="btn btn-primary mt-3 !min-h-10" onClick={() => composer.current?.focus("encouragement")}>
                  {t("community.answerPrompt")}
                </button>
              </section>
            ) : null}

            {me?.member.status === "active" ? (
              <Composer
                ref={composer}
                token={token}
                circles={meta.circles}
                circle={circle}
                limit={meta.limits.post_chars ?? 2000}
                onPosted={(post, result) => {
                  setOutcome(result);
                  setPosts((list) => [post, ...list]);
                }}
              />
            ) : null}
            {outcome ? <ModerationNotice outcome={outcome} /> : null}

            {posts.length ? (
              <ul className="space-y-3">
                {posts.map((post) => (
                  <li key={post.id}>
                    <PostCard
                      post={post}
                      token={token}
                      reactions={meta.reactions}
                      onChange={update}
                      onDeleted={(id) => setPosts((list) => list.filter((p) => p.id !== id))}
                      onBlocked={(handle) => {
                        setPosts((list) => list.filter((p) => p.author?.handle !== handle));
                        setNotice(t("community.blocked"));
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : !loading ? (
              <p className="card p-6 text-center text-ink-2">{t("community.empty")}</p>
            ) : null}
            {error ? <p className="text-sm text-critical">{error}</p> : null}
            {cursor ? (
              <button type="button" className="btn btn-ghost w-full" onClick={() => void load(false)} disabled={loading}>
                {loading ? t("common.loading") : t("community.loadMore")}
              </button>
            ) : null}
          </>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <nav aria-label={t("community.circle")} className="card hidden p-2 lg:block">
          {[{ id: null, title: t("community.allCircles"), icon: "users" as IconName }, ...meta.circles.map((c) => ({ id: c.id, title: c.title, icon: CIRCLE_ICON[c.icon] ?? "users" }))].map((c) => (
            <button
              key={c.id ?? "all"}
              type="button"
              onClick={() => setCircle(c.id)}
              aria-pressed={circle === c.id}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${circle === c.id ? "bg-brand-soft text-brand-strong" : "text-ink-2 hover:bg-surface-2"}`}
            >
              <Icon name={c.icon} size={18} />
              {c.title}
            </button>
          ))}
        </nav>
        {token && me ? <Activity me={me} token={token} onSeen={refreshMe} /> : null}
        <section className="card space-y-2 p-4 text-sm text-ink-2">
          <p className="flex gap-2">
            <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
            {t("community.membersOnly")}
          </p>
          <p className="flex gap-2">
            <Icon name="phone" size={16} className="mt-0.5 shrink-0" />
            {t("community.g5")}
          </p>
          <Link href={`/${lang}/community/guidelines`} className="inline-block font-semibold text-brand hover:underline">
            {t("community.guidelinesTitle")} →
          </Link>
        </section>
        {token && me ? <AccountPanel me={me} token={token} onSignedOut={signOut} /> : null}
      </aside>
    </div>
  );
}
