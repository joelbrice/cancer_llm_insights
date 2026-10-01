import { createTranslator, DEFAULT_LOCALE } from "@vitacite/shared";
import Link from "next/link";

import { EmptyState } from "@/components/blocks";

export default function NotFound() {
  const t = createTranslator(DEFAULT_LOCALE);
  return (
    <EmptyState icon="search" title={t("common.notFound")}>
      <Link href="/" className="btn btn-primary">
        {t("common.goHome")}
      </Link>
    </EmptyState>
  );
}
