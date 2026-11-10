"use client";

import { brandName, STORAGE_KEYS } from "@stepwell/shared";
import { useEffect, useRef } from "react";

import { useT } from "@/lib/i18n-client";
import { useLocalState } from "@/lib/storage";

import { Icon, Logo, type IconName } from "./Icon";

const POINTS: { key: "evidence" | "notAdvice" | "emergency" | "privacy"; icon: IconName }[] = [
  { key: "evidence", icon: "shield" },
  { key: "notAdvice", icon: "info" },
  { key: "emergency", icon: "phone" },
  { key: "privacy", icon: "lock" },
];

/** First-launch notice (BUILD_SPEC §11.3): educational, not medical advice; emergencies; privacy. Shown once per device. */
export function WelcomeNotice() {
  const t = useT();
  const [seen, setSeen, loaded] = useLocalState<boolean>(STORAGE_KEYS.welcome, false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (loaded && !seen && !dialog.current?.open) dialog.current?.showModal();
  }, [loaded, seen]);

  if (!loaded || seen) return null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="welcome-title"
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[min(32rem,92vw)] rounded-3xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50"
    >
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <h2 id="welcome-title" className="text-xl font-bold">
            {t("welcome.title", { app: brandName() })}
          </h2>
        </div>
        <p className="text-ink-2">{t("welcome.intro")}</p>
        <ul className="space-y-3">
          {POINTS.map((p) => (
            <li key={p.key} className="flex gap-3">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${p.key === "emergency" ? "bg-critical-soft text-critical" : "bg-brand-soft text-brand"}`}>
                <Icon name={p.icon} size={16} />
              </span>
              <span className="text-[0.95rem] leading-snug">{t(`welcome.${p.key}`)}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-primary w-full"
          autoFocus
          onClick={() => {
            setSeen(true);
            dialog.current?.close();
          }}
        >
          {t("welcome.accept")}
        </button>
      </div>
    </dialog>
  );
}
