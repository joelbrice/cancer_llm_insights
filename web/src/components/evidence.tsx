import {
  formatAuthors,
  highlightQuote,
  LEVEL_STEPS,
  pageLabel,
  sourceLink,
  translateDynamic,
  type Citation,
  type EvidenceLevelId,
  type Translate,
} from "@vitacite/shared";

import { Icon } from "./Icon";

const LEVEL_VAR: Record<EvidenceLevelId, string> = {
  high: "var(--ev-high)",
  moderate: "var(--ev-moderate)",
  low: "var(--ev-low)",
  very_low: "var(--ev-very-low)",
  insufficient: "var(--ev-none)",
};

/** Four-step ordinal meter: the filled steps carry the level, the track is a lighter step of the same ramp. */
export function EvidenceMeter({ level, size = "md" }: { level: EvidenceLevelId; size?: "sm" | "md" | "lg" }) {
  const filled = LEVEL_STEPS[level];
  const dims = { sm: [6, 10, 2], md: [8, 14, 2], lg: [12, 20, 3] }[size];
  const [w, h, gap] = dims as [number, number, number];
  return (
    <svg width={4 * w + 3 * gap} height={h} aria-hidden="true" focusable="false" className="shrink-0">
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i * (w + gap)}
          y={h - (h * (i + 2)) / 5}
          width={w}
          height={(h * (i + 2)) / 5}
          rx={2}
          fill={i < filled ? LEVEL_VAR[level] : "var(--ev-track)"}
        />
      ))}
    </svg>
  );
}

export function EvidenceBadge({
  level,
  grade,
  t,
  size = "md",
  showGrade = true,
}: {
  level: EvidenceLevelId;
  grade: string;
  t: Translate;
  size?: "sm" | "md" | "lg";
  showGrade?: boolean;
}) {
  const label = t(`levels.${level}`);
  const gradeText = level === "insufficient" ? "" : t("levels.gradeLabel", { grade });
  const text = size === "lg" ? "text-base" : size === "sm" ? "text-xs" : "text-sm";
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-2.5 py-1 font-semibold text-ink ${text}`}
      role="img"
      aria-label={`${gradeText ? `${gradeText} — ` : ""}${label}`}
      title={t(`levels.${level}Desc` as Parameters<Translate>[0])}
    >
      <EvidenceMeter level={level} size={size} />
      <span aria-hidden="true">
        {showGrade && gradeText ? <span className="text-ink-2">{gradeText} · </span> : null}
        {label}
      </span>
    </span>
  );
}

/** Support of a statement by its cited passage (0–1), as a same-ramp meter + label. */
export function SupportMeter({ support, label, t }: { support: number | null; label: Citation["support_label"]; t: Translate }) {
  const pct = support === null ? 0 : Math.round(support * 100);
  const color = label === "strong" ? "var(--ev-high)" : label === "partial" ? "var(--ev-low)" : "var(--ev-very-low)";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-2">
      <span className="relative h-1.5 w-14 overflow-hidden rounded-full" style={{ background: "var(--ev-track)" }} aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </span>
      {t(`insights.support.${label}`)}
    </span>
  );
}

export function DesignChip({ id, t }: { id: string; t: Translate }) {
  return <span className="chip">{translateDynamic(t, "designs", id)}</span>;
}

export function CitationCard({ citation, t, anchorPrefix = "ref" }: { citation: Citation; t: Translate; anchorPrefix?: string }) {
  const s = citation.source;
  const link = sourceLink(s);
  const [before, quote, after] = highlightQuote(citation);
  const page = pageLabel(citation);
  const meta = [formatAuthors(s.authors), s.journal || s.publisher, s.year ? String(s.year) : null].filter(Boolean).join(" · ");
  return (
    <li id={`${anchorPrefix}-${citation.n}`} className="card scroll-mt-24 p-4 target:ring-2 target:ring-[var(--focus)]">
      <div className="flex items-start gap-3">
        <span className="cite mt-0.5 shrink-0" aria-hidden="true">
          {citation.n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-ink">
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {s.title}
                <Icon name="external" size={14} className="ml-1 inline align-[-2px] text-ink-3" />
                <span className="sr-only"> ({t("insights.openSource")})</span>
              </a>
            ) : (
              s.title
            )}
          </p>
          {meta ? <p className="mt-0.5 text-sm text-ink-2">{meta}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <DesignChip id={s.source_type} t={t} />
            <span className="chip">{translateDynamic(t, "credibility", s.credibility)}</span>
            {page ? <span className="chip">{t("insights.page", { page })}</span> : null}
            {citation.section ? <span className="chip max-w-[14rem] truncate">{citation.section}</span> : null}
          </div>
          <blockquote className="mt-3 border-l-2 border-[var(--series-1)] pl-3 text-[0.95rem] leading-relaxed text-ink">
            <span className="sr-only">{t("insights.quote")}: </span>“{citation.quote}”
          </blockquote>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <SupportMeter support={citation.support} label={citation.support_label} t={t} />
            {s.doi ? <span className="text-xs text-ink-3">doi:{s.doi}</span> : s.pmid ? <span className="text-xs text-ink-3">PMID {s.pmid}</span> : null}
          </div>
          {citation.passage && citation.passage !== citation.quote ? (
            <details className="group mt-2">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-brand">
                <Icon name="chevronDown" size={16} className="transition group-open:rotate-180" />
                {t("insights.context")}
              </summary>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-ink-2">
                {before}
                <mark className="quote-mark">{quote}</mark>
                {after}
              </p>
            </details>
          ) : null}
        </div>
      </div>
    </li>
  );
}
