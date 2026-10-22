"use client";

import type { Citation } from "@stepwell/shared";
import { useEffect, useRef } from "react";

import { useT } from "@/lib/i18n-client";

import { CitationCard } from "../evidence";
import { Icon } from "../Icon";

/** Native <dialog>: focus trap, Esc to close and a backdrop for free; a bottom sheet on phones. */
export function CitationDialog({ citation, onClose }: { citation: Citation | null; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (citation && !dialog.open) dialog.showModal();
    if (!citation && dialog.open) dialog.close();
  }, [citation]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={citation ? citation.source.title : t("ask.sources")}
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-bg p-0 text-ink shadow-card sm:m-auto sm:max-w-2xl sm:rounded-3xl"
    >
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <span className="text-sm font-semibold text-ink-2">{t("ask.sources")}</span>
        <button type="button" className="btn btn-ghost h-11 w-11 !p-0" onClick={onClose} aria-label={t("common.close")}>
          <Icon name="x" />
        </button>
      </div>
      <div className="max-h-[75dvh] overflow-y-auto px-4 pb-6">
        {citation ? (
          <ol>
            <CitationCard citation={citation} t={t} anchorPrefix="dialog-ref" />
          </ol>
        ) : null}
      </div>
    </dialog>
  );
}
