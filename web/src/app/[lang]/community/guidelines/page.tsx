import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/blocks";
import { Icon, type IconName } from "@/components/Icon";
import { href, resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("community.guidelinesTitle") };
}

const RULES: { key: "g1" | "g2" | "g3" | "g4" | "g5" | "g6"; icon: IconName }[] = [
  { key: "g1", icon: "heart" },
  { key: "g2", icon: "chat" },
  { key: "g3", icon: "lock" },
  { key: "g4", icon: "x" },
  { key: "g5", icon: "phone" },
  { key: "g6", icon: "shield" },
];

export default async function GuidelinesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await resolveLocale(params);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("community.guidelinesTitle")} subtitle={t("community.subtitle")} />
      <ol className="space-y-3">
        {RULES.map((rule, i) => (
          <li key={rule.key} className="card flex gap-4 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Icon name={rule.icon} />
            </span>
            <div>
              <h2 className="font-semibold text-ink">
                {i + 1}. {t(`community.${rule.key}Title`)}
              </h2>
              <p className="mt-1 text-ink-2">{t(`community.${rule.key}`)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-ink-2">{t("community.membersOnly")}</p>
      <p className="mt-2 text-sm">
        <Link href={href(lang, "/transparency")} className="font-semibold text-brand underline underline-offset-2">
          {t("community.transparencyLink")}
        </Link>
      </p>
      <Link href={href(lang, "/community")} className="btn btn-primary mt-4">
        {t("home.communityCta")}
      </Link>
    </div>
  );
}
