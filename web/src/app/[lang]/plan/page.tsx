import type { Metadata } from "next";

import { PageHeader } from "@/components/blocks";
import { PlanView } from "@/components/PlanView";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("plan.title"), robots: { index: false } };
}

export default async function PlanPage({ params }: { params: Promise<{ lang: string }> }) {
  const { t } = await resolveLocale(params);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("plan.title")} subtitle={t("plan.subtitle")} />
      <PlanView />
    </div>
  );
}
