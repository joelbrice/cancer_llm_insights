import { AUDIENCES, DICTIONARIES, translateDynamic, type Audience, type InsightQuery } from "@stepwell/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { ApiDown, DataStatusCard, EmptyState, InsightCard, PageHeader } from "@/components/blocks";
import { Icon, TextArrow } from "@/components/Icon";
import { api, load } from "@/lib/api";
import { href, resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("insights.title"), description: t("insights.subtitle") };
}

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function InsightsPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Search> }) {
  const { lang, t } = await resolveLocale(params);
  const sp = await searchParams;
  const query: InsightQuery = {
    lang,
    category: one(sp.category),
    audience: one(sp.audience) as Audience | undefined,
    min_level: one(sp.min_level) as InsightQuery["min_level"],
    q: one(sp.q),
    page: Math.max(1, Number(one(sp.page)) || 1),
    page_size: 24,
  };
  const [list, topics, status] = await Promise.all([
    load(() => api.insights(query)),
    load(() => api.topics(lang)),
    load(() => api.status()),
  ]);
  const categories = Object.keys(DICTIONARIES.en.categories);
  const filtered = Boolean(query.category || query.audience || query.min_level || query.q);
  const published = topics.data?.filter((x) => x.status === "published").length ?? 0;
  const pending = topics.data?.filter((x) => x.status !== "published") ?? [];
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.page_size)) : 1;
  const pageHref = (page: number) => {
    const params = new URLSearchParams(Object.entries({ ...query, lang: undefined, page_size: undefined, page }).filter(([, v]) => v).map(([k, v]) => [k, String(v)]));
    return href(lang, `/insights?${params.toString()}`);
  };

  return (
    <div>
      <PageHeader title={t("insights.title")} subtitle={t("insights.subtitle")}>
        {topics.data ? <p className="text-sm text-ink-2">{t("insights.topicsCovered", { published, total: topics.data.length })}</p> : null}
      </PageHeader>

      <form method="get" className="card mb-6 grid gap-3 p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end" role="search">
        <div>
          <label className="label" htmlFor="f-q">
            {t("common.search")}
          </label>
          <input id="f-q" name="q" defaultValue={query.q} className="field" placeholder={t("insights.searchPlaceholder")} />
        </div>
        <div>
          <label className="label" htmlFor="f-cat">
            {t("insights.category")}
          </label>
          <select id="f-cat" name="category" defaultValue={query.category ?? ""} className="field">
            <option value="">{t("common.all")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {translateDynamic(t, "categories", c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-aud">
            {t("insights.audience")}
          </label>
          <select id="f-aud" name="audience" defaultValue={query.audience ?? ""} className="field">
            <option value="">{t("common.all")}</option>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {t(`audiences.${a}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-lvl">
            {t("insights.minLevel")}
          </label>
          <select id="f-lvl" name="min_level" defaultValue={query.min_level ?? ""} className="field">
            <option value="">{t("insights.any")}</option>
            {(["high", "moderate", "low"] as const).map((l) => (
              <option key={l} value={l}>
                {t(`levels.${l}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1 md:flex-none">
            <Icon name="search" size={18} />
            {t("common.search")}
          </button>
          {filtered ? (
            <Link href={href(lang, "/insights")} className="btn btn-ghost">
              {t("common.clear")}
            </Link>
          ) : null}
        </div>
      </form>

      {!list.data ? (
        <ApiDown t={t} />
      ) : list.data.items.length ? (
        <>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.data.items.map((insight) => (
              <InsightCard key={insight.id} insight={insight} lang={lang} t={t} />
            ))}
          </ul>
          {pages > 1 ? (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              {list.data.page > 1 ? (
                <Link className="btn btn-ghost" href={pageHref(list.data.page - 1)}>
                  <TextArrow back /> {t("common.previous")}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-ink-2">{t("common.page", { page: list.data.page, pages })}</span>
              {list.data.page < pages ? (
                <Link className="btn btn-ghost" href={pageHref(list.data.page + 1)}>
                  {t("common.next")} <TextArrow />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      ) : filtered ? (
        <EmptyState icon="search" title={t("insights.noMatch")} />
      ) : (
        <div className="space-y-4">
          {status.data ? <DataStatusCard status={status.data} lang={lang} t={t} /> : null}
          <EmptyState icon="spark" title={t("insights.emptyTitle")} body={t("insights.emptyBody")} />
        </div>
      )}

      {pending.length && !filtered ? (
        <section className="mt-10" aria-labelledby="pending">
          <h2 id="pending" className="mb-3 text-sm font-semibold text-ink-2">
            {t("insights.awaitingEvidence")} ({pending.length})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {pending.map((topic) => (
              <li key={topic.id} className="chip" title={topic.question}>
                {topic.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
