import { BRAND, brandName } from "@stepwell/shared";
import type { Metadata } from "next";

import { PageHeader } from "@/components/blocks";
import { Icon, Logo } from "@/components/Icon";
import { api, load } from "@/lib/api";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("about.title") };
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { t } = await resolveLocale(params);
  const status = await load(() => api.status());
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("about.title")} />
      <p className="text-lg leading-relaxed text-ink">{t("about.mission")}</p>
      <section className="card flex gap-4 p-5">
        <span className="shrink-0">
          <Logo size={40} />
        </span>
        <div>
          <h2 className="font-semibold">{t("about.nameTitle")}</h2>
          <p className="mt-2 text-ink-2">{t("about.name")}</p>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon name="users" size={18} />
          {t("about.forTitle")}
        </h2>
        <p className="mt-2 text-ink-2">{t("about.for")}</p>
      </section>
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon name="lock" size={18} />
          {t("about.privacyTitle")}
        </h2>
        <p className="mt-2 text-ink-2">{t("about.privacy")}</p>
      </section>
      <section className="card border-warning p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon name="alert" size={18} className="text-warning-ink" />
          {t("about.safetyTitle")}
        </h2>
        <p className="mt-2 text-ink-2">{t("about.safety")}</p>
      </section>
      <p className="text-sm text-ink-3">
        {brandName()} · {t("about.version", { version: status.data?.version ?? "1.0.0" })} · {t("about.openSource")}{" "}
        <a className="text-brand underline underline-offset-2" href={BRAND.repository} rel="noopener noreferrer" target="_blank">
          GitHub
        </a>
      </p>
    </div>
  );
}
