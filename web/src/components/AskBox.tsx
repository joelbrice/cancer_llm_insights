"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale, useT } from "@/lib/i18n-client";

import { Icon } from "./Icon";

/** Home-page question box: hands the question to the Ask page (which streams the answer). */
export function AskBox() {
  const t = useT();
  const lang = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className="flex gap-2 rounded-full border border-line-strong bg-surface p-1.5 shadow-card focus-within:outline focus-within:outline-2 focus-within:outline-[var(--focus)]"
      onSubmit={(event) => {
        event.preventDefault();
        if (q.trim()) router.push(`/${lang}/ask?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <label htmlFor="home-ask" className="sr-only">
        {t("ask.placeholder")}
      </label>
      <input
        id="home-ask"
        className="min-w-0 flex-1 bg-transparent px-4 text-base text-ink outline-none placeholder:text-ink-3"
        placeholder={t("home.askPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={1000}
        autoComplete="off"
        enterKeyHint="send"
      />
      <button type="submit" className="btn btn-primary !min-h-11" disabled={!q.trim()} aria-label={t("home.askCta")}>
        <Icon name="send" size={18} />
        <span className="hidden sm:inline">{t("home.askCta")}</span>
      </button>
    </form>
  );
}
