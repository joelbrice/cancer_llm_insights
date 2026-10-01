import type { Metadata } from "next";

import { AdminConsole } from "@/components/AdminConsole";
import { PageHeader } from "@/components/blocks";
import { CommunityModeration } from "@/components/community/Moderation";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("admin.title"), robots: { index: false, follow: false } };
}

export default async function AdminPage({ params }: { params: Promise<{ lang: string }> }) {
  const { t } = await resolveLocale(params);
  return (
    <div>
      <PageHeader title={t("admin.title")} subtitle={t("admin.subtitle")} />
      <AdminConsole />
      <div className="mt-10">
        <CommunityModeration />
      </div>
    </div>
  );
}
