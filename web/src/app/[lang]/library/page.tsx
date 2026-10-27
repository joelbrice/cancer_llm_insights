import { formatAuthors, translateDynamic, type DocumentQuery } from "@stepwell/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { ApiDown, DataStatusCard, EmptyState, PageHeader } from "@/components/blocks";
import { DesignChip } from "@/components/evidence";
import { Icon, TextArrow } from "@/components/Icon";
import { api, load } from "@/lib/api";
import { href, resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("library.title"), description: t("library.subtitle") };
}

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function LibraryPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Search> }) {
  const { lang, t } = await resolveLocale(params);
  const sp = await searchParams;
  const query: DocumentQuery = {
    q: one(sp.q),
    source_type: one(sp.source_type),
    language: one(sp.language),
    sort: (one(sp.sort) as DocumentQuery["sort"]) ?? "quality",
    page: Math.max(1, Number(one(sp.page)) || 1),
    page_size: 25,
  };
  const [docs, status] = await Promise.all([load(() => api.documents(query)), load(() => api.status())]);
  const types = Object.entries(docs.data?.facets.source_type ?? {}).sort((a, b) => b[1] - a[1]);
  const pages = docs.data ? Math.max(1, Math.ceil(docs.data.total / docs.data.page_size)) : 1;
  const pageHref = (page: number) => {
    const params = new URLSearchParams(Object.entries({ ...query, page_size: undefined, page }).filter(([, v]) => v).map(([k, v]) => [k, String(v)]));
    return href(lang, `/library?${params.toString()}`);
  };

  return (
    <div>
      <PageHeader title={t("library.title")} subtitle={t("library.subtitle")} />
      <form method="get" className="card mb-6 grid gap-3 p-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end" role="search">
        <div>
          <label className="label" htmlFor="l-q">
            {t("common.search")}
          </label>
          <input id="l-q" name="q" defaultValue={query.q} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="l-type">
            {t("library.type")}
          </label>
          <select id="l-type" name="source_type" defaultValue={query.source_type ?? ""} className="field">
            <option value="">{t("common.all")}</option>
            {types.map(([id, n]) => (
              <option key={id} value={id}>
                {translateDynamic(t, "designs", id)} ({n})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="l-sort">
            {t("library.sort")}
          </label>
          <select id="l-sort" name="sort" defaultValue={query.sort} className="field">
            <option value="quality">{t("library.sortQuality")}</option>
            <option value="year">{t("library.sortYear")}</option>
            <option value="title">{t("library.sortTitle")}</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          <Icon name="search" size={18} />
          {t("common.search")}
        </button>
      </form>

      {!docs.data ? (
        <ApiDown t={t} />
      ) : docs.data.items.length === 0 ? (
        <div className="space-y-4">
          {status.data && status.data.data_status !== "ready" ? <DataStatusCard status={status.data} lang={lang} t={t} /> : null}
          <EmptyState icon="layers" title={t("library.empty")} />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-line bg-surface">
            {docs.data.items.map((doc) => (
              <li key={doc.id}>
                <Link href={href(lang, `/library/${encodeURIComponent(doc.id)}`)} className="flex flex-col gap-2 p-4 hover:bg-surface-2 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-ink">{doc.title}</p>
                    <p className="mt-0.5 truncate text-sm text-ink-2">
                      {[formatAuthors(doc.authors), doc.journal || doc.publisher, doc.year].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <DesignChip id={doc.source_type} t={t} />
                    <span className="chip">{translateDynamic(t, "credibility", doc.credibility)}</span>
                    <span className="chip uppercase">{doc.language}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2" title={t("library.quality")}>
                      <span className="relative h-1.5 w-12 overflow-hidden rounded-full" style={{ background: "var(--ev-track)" }} aria-hidden="true">
                        <span className="absolute inset-y-0 start-0 rounded-full" style={{ width: `${Math.round(doc.quality_score * 100)}%`, background: "var(--series-1)" }} />
                      </span>
                      <span className="tabular-nums">{Math.round(doc.quality_score * 100)}</span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              {docs.data.page > 1 ? (
                <Link className="btn btn-ghost" href={pageHref(docs.data.page - 1)}>
                  <TextArrow back /> {t("common.previous")}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-ink-2">{t("common.page", { page: docs.data.page, pages })}</span>
              {docs.data.page < pages ? (
                <Link className="btn btn-ghost" href={pageHref(docs.data.page + 1)}>
                  {t("common.next")} <TextArrow />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
