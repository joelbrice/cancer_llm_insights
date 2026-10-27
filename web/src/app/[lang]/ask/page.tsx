import type { Metadata } from "next";

import { ChatView } from "@/components/chat/ChatView";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("ask.title"), description: t("ask.subtitle") };
}

export default async function AskPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await resolveLocale(params);
  const { q } = await searchParams;
  const question = Array.isArray(q) ? q[0] : q;
  return <ChatView initialQuestion={question?.slice(0, 1000)} />;
}
