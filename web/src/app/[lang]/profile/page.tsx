import type { Metadata } from "next";

import { PageHeader } from "@/components/blocks";
import { Icon } from "@/components/Icon";
import { ProfileForm } from "@/components/ProfileForm";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("profile.title"), robots: { index: false } };
}

export default async function ProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const { t } = await resolveLocale(params);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("profile.title")} />
      <p className="mb-4 flex items-start gap-2 text-sm text-ink-2">
        <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
        {t("profile.privacy")}
      </p>
      <ProfileForm />
    </div>
  );
}
