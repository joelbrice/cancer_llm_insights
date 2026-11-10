"use client";

import { useT } from "@/lib/i18n-client";

import { Icon } from "@/components/Icon";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
      <Icon name="alert" size={28} className="text-warning-ink" />
      <h1 className="text-lg font-semibold">{t("common.error")}</h1>
      <p className="max-w-md text-ink-2">{t("common.apiUnreachable")}</p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        {t("common.retry")}
      </button>
    </div>
  );
}
