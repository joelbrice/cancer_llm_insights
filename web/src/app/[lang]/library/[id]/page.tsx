import { formatAuthors, formatReference, sourceLink, translateDynamic } from "@stepwell/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiDown } from "@/components/blocks";
import { DesignChip } from "@/components/evidence";
import { Icon } from "@/components/Icon";
import { api, load } from "@/lib/api";
import { href, resolveLocale } from "@/lib/i18n";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const res = await load(() => api.document(decodeURIComponent(id)));
  return res.data ? { title: res.data.title } : {};
}

export default async function DocumentPage({ params }: Props) {
  const { lang, t } = await resolveLocale(params);
  const { id } = await params;
  const res = await load(() => api.document(decodeURIComponent(id), lang));
  if (res.error?.status === 404) notFound();
  if (!res.data) return <ApiDown t={t} />;
  const doc = res.data;
  const link = sourceLink(doc);
  const basis = doc.source_type_basis ?? "none";

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-2">
        <Link href={href(lang, "/library")} className="hover:underline">
          {t("library.title")}
        </Link>
      </nav>
      <header className="space-y-3">
        <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">{doc.title}</h1>
        <p className="text-ink-2">{[formatAuthors(doc.authors, 6), doc.journal || doc.publisher, doc.year].filter(Boolean).join(" · ")}</p>
        <div className="flex flex-wrap gap-2">
          <DesignChip id={doc.source_type} t={t} />
          <span className="chip">{translateDynamic(t, "credibility", doc.credibility)}</span>
          <span className="chip uppercase">{doc.language}</span>
          <span className="chip">
            {t("library.quality")}: {Math.round(doc.quality_score * 100)}/100
          </span>
          {doc.license ? <span className="chip">{doc.license}</span> : null}
        </div>
        <p className="text-sm text-ink-3">
          {t("library.classifiedBy", { basis: translateDynamic(t, "library.basis", basis) })}
          {doc.source_type_confidence ? ` (${Math.round(doc.source_type_confidence * 100)}%)` : ""}
        </p>
        {doc.retracted ? (
          <p className="flex items-center gap-2 rounded-xl border border-critical bg-critical-soft p-3 font-semibold text-critical" role="alert">
            <Icon name="octagon" size={18} />
            {t("library.retracted")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <Icon name="external" size={18} />
              {t("insights.openSource")}
            </a>
          ) : null}
        </div>
        <p className="rounded-xl bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink-2">{formatReference(doc.source)}</p>
      </header>

      {doc.cited_by.length ? (
        <section aria-labelledby="cited">
          <h2 id="cited" className="mb-2 font-semibold">
            {t("library.citedBy")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {doc.cited_by.map((i) => (
              <li key={i.id}>
                <Link href={href(lang, `/insights/${encodeURIComponent(i.id)}`)} className="chip hover:text-ink">
                  <Icon name="spark" size={14} />
                  {i.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {doc.abstract ? (
        <section aria-labelledby="abs" className="card p-5">
          <h2 id="abs" className="mb-2 font-semibold">
            {t("library.abstract")}
          </h2>
          <p className="whitespace-pre-wrap leading-relaxed text-ink-2">{doc.abstract}</p>
        </section>
      ) : null}

      <section aria-labelledby="passages">
        <h2 id="passages" className="mb-3 font-semibold">
          {t("library.passages")} ({doc.chunks.length})
        </h2>
        <ol className="space-y-3">
          {doc.chunks.map((chunk) => (
            <li key={chunk.id} id={chunk.id} className="card scroll-mt-24 p-4">
              <p className="mb-2 flex flex-wrap gap-2 text-xs text-ink-3">
                <span>#{chunk.ordinal + 1}</span>
                {chunk.section ? <span>· {chunk.section}</span> : null}
                {chunk.page_start ? <span>· {t("insights.page", { page: chunk.page_start })}</span> : null}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{chunk.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
