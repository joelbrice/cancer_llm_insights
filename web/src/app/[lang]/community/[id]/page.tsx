import type { Metadata } from "next";

import { CommunityThread } from "@/components/community/Thread";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("community.title"), robots: { index: false, follow: false } };
}

export default async function ThreadPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { id } = await params;
  return <CommunityThread id={decodeURIComponent(id)} />;
}
