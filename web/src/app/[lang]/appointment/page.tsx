import type { Metadata } from "next";

import { AppointmentBuilder } from "@/components/AppointmentBuilder";
import { PageHeader } from "@/components/blocks";
import { Icon } from "@/components/Icon";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("appointment.title"), description: t("appointment.subtitle") };
}

export default async function AppointmentPage({ params }: { params: Promise<{ lang: string }> }) {
  const { t } = await resolveLocale(params);
  return (
    <div>
      <PageHeader title={t("appointment.title")} subtitle={t("appointment.subtitle")} />
      <p className="no-print mb-6 flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
        <Icon name="info" size={16} className="mt-0.5 shrink-0" />
        {t("appointment.notAdvice")}
      </p>
      <AppointmentBuilder />
    </div>
  );
}
