import type { Metadata } from "next";

import { PageHeader } from "@/components/blocks";
import { CommunityApp } from "@/components/community/CommunityApp";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("community.title"), description: t("community.subtitle"), robots: { index: false, follow: false } };
}

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { t } = await resolveLocale(params);
  return (
    <div>
      <PageHeader title={t("community.title")} subtitle={t("community.subtitle")} />
      <CommunityApp />
    </div>
  );
}
