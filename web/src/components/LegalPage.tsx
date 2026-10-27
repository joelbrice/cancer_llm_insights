import { LEGAL_PAGES, renderLegal, type LegalPageId, type Translate } from "@stepwell/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/blocks";
import { Icon } from "@/components/Icon";
import { api, load } from "@/lib/api";
import { href, resolveLocale } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };

export async function legalMetadata({ params }: Params, page: LegalPageId): Promise<Metadata> {
  const { lang, t } = await resolveLocale(params);
  return { title: renderLegal(lang, page, null, t).title };
}

export function legalLinkLabel(t: Translate, page: LegalPageId): string {
  return t(`legal.${page}`);
}

/** Privacy policy, terms, legal notice or accessibility statement, with the operator's details from the API. */
export async function LegalPage({ params, page }: Params & { page: LegalPageId }) {
  const { lang, t } = await resolveLocale(params);
  const info = await load(() => api.legal());
  const doc = renderLegal(lang, page, info.data, t);
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={doc.title} subtitle={doc.date ? t("legal.version", { date: doc.date }) : undefined} />
      {doc.draft ? (
        <p role="note" className="card flex gap-2 border-warning p-4 text-sm text-ink-2">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warning-ink" />
          {t("legal.draft")}
        </p>
      ) : null}
      {info.error ? <p className="text-sm text-ink-3">{t("legal.unavailable")}</p> : null}
      <p className="text-lg leading-relaxed text-ink">{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.h} className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">{section.h}</h2>
          {section.blocks.map((block, i) =>
            block.type === "ul" ? (
              <ul key={i} className="list-disc space-y-1 ps-6 text-ink-2">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className="leading-relaxed text-ink-2">
                {block.text}
              </p>
            ),
          )}
        </section>
      ))}
      <nav aria-label={t("legal.title")} className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
        {LEGAL_PAGES.filter((p) => p !== page).map((p) => (
          <Link key={p} className="text-brand underline underline-offset-2" href={href(lang, `/${p}`)}>
            {legalLinkLabel(t, p)}
          </Link>
        ))}
      </nav>
    </article>
  );
}
