import type { Metadata } from "next";

import { PageHeader } from "@/components/blocks";
import { Icon } from "@/components/Icon";
import { LifestyleCheck } from "@/components/LifestyleCheck";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("check.title"), description: t("check.subtitle") };
}

export default async function CheckPage({ params }: { params: Promise<{ lang: string }> }) {
  const { t } = await resolveLocale(params);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("check.title")} subtitle={t("check.subtitle")} />
      <p className="mb-4 flex items-center gap-2 text-sm text-ink-2">
        <Icon name="lock" size={16} />
        {t("check.privacy")}
      </p>
      <LifestyleCheck />
    </div>
  );
}
