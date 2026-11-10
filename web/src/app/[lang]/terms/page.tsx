import type { Metadata } from "next";

import { LegalPage, legalMetadata } from "@/components/LegalPage";

type Props = { params: Promise<{ lang: string }> };

export function generateMetadata(props: Props): Promise<Metadata> {
  return legalMetadata(props, "terms");
}

export default function Page({ params }: Props) {
  return <LegalPage params={params} page="terms" />;
}
