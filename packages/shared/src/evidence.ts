/** Evidence presentation helpers shared by web and mobile (ordering, ordinal colour steps, citations). */
import type { Citation, EvidenceLevelId, SourceRef } from "./types";

export const LEVEL_ORDER: EvidenceLevelId[] = ["high", "moderate", "low", "very_low", "insufficient"];

export const LEVEL_GRADE: Record<EvidenceLevelId, string> = {
  high: "A",
  moderate: "B",
  low: "C",
  very_low: "D",
  insufficient: "–",
};

/** Number of filled segments in the 4-step evidence meter. */
export const LEVEL_STEPS: Record<EvidenceLevelId, number> = { high: 4, moderate: 3, low: 2, very_low: 1, insufficient: 0 };

/**
 * Ordinal blue ramp (validated with the data-viz palette validator, --ordinal, both modes):
 * strength of evidence is a magnitude, so it uses one hue light→dark — not status red/green,
 * because "low evidence" means *uncertain*, not *bad*.
 */
export const LEVEL_COLORS: Record<"light" | "dark", Record<EvidenceLevelId, string>> = {
  light: { high: "#1c5cab", moderate: "#2a78d6", low: "#5598e7", very_low: "#86b6ef", insufficient: "#c3c2b7" },
  dark: { high: "#86b6ef", moderate: "#3987e5", low: "#256abf", very_low: "#184f95", insufficient: "#383835" },
};

/** Evidence-pyramid tier of each study design (1 = strongest). Mirrors backend DESIGN tiers. */
export const DESIGN_TIER: Record<string, number> = {
  umbrella_review: 1,
  meta_analysis: 1,
  systematic_review: 1,
  guideline: 1,
  rct: 2,
  cohort: 3,
  case_control: 3,
  cross_sectional: 4,
  narrative_review: 4,
  institutional_web: 4,
  case_series: 5,
  expert_opinion: 5,
  preclinical: 6,
  news: 6,
  blog: 6,
  unknown: 6,
};

export const DESIGN_ORDER = Object.keys(DESIGN_TIER);

export function levelRank(level: EvidenceLevelId): number {
  return LEVEL_ORDER.indexOf(level);
}

/** Sort a design→count breakdown by pyramid tier (strongest first). */
export function sortedDesigns(breakdown: Record<string, number>): { id: string; count: number; tier: number }[] {
  return Object.entries(breakdown)
    .map(([id, count]) => ({ id, count, tier: DESIGN_TIER[id] ?? 6 }))
    .sort((a, b) => a.tier - b.tier || DESIGN_ORDER.indexOf(a.id) - DESIGN_ORDER.indexOf(b.id));
}

/** Canonical link to a source: DOI → PubMed → URL. */
export function sourceLink(source: Pick<SourceRef, "doi" | "pmid" | "url">): string | null {
  if (source.doi) return `https://doi.org/${source.doi}`;
  if (source.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${source.pmid}/`;
  if (source.url && /^https?:\/\//i.test(source.url)) return source.url;
  return null;
}

/** Vancouver-style author list: up to 3 names then "et al.". */
export function formatAuthors(authors: string[], max = 3): string {
  if (!authors.length) return "";
  return authors.length > max ? `${authors.slice(0, max).join(", ")}, et al.` : authors.join(", ");
}

/** Vancouver-style reference string (common in medicine). */
export function formatReference(source: SourceRef): string {
  const parts = [
    formatAuthors(source.authors),
    source.title,
    source.journal || source.publisher || "",
    source.year ? String(source.year) : "",
  ]
    .map((part) => part.trim().replace(/\.+$/, ""))
    .filter(Boolean);
  let text = parts.join(". ") + ".";
  if (source.doi) text += ` doi:${source.doi}`;
  else if (source.pmid) text += ` PMID: ${source.pmid}`;
  return text;
}

export function pageLabel(citation: Pick<Citation, "page_start" | "page_end">): string | null {
  if (!citation.page_start) return null;
  return citation.page_end && citation.page_end !== citation.page_start
    ? `${citation.page_start}–${citation.page_end}`
    : String(citation.page_start);
}

/** Split a passage into [before, quote, after] for highlighting the supporting sentence. */
export function highlightQuote(citation: Pick<Citation, "passage" | "quote" | "quote_start" | "quote_end">): [string, string, string] {
  const { passage, quote_start: start, quote_end: end } = citation;
  if (passage && end > start && passage.slice(start, end) === citation.quote) {
    return [passage.slice(0, start), passage.slice(start, end), passage.slice(end)];
  }
  const index = passage.indexOf(citation.quote);
  if (index >= 0) return [passage.slice(0, index), citation.quote, passage.slice(index + citation.quote.length)];
  return ["", citation.quote, ""];
}

export interface AnswerSegment {
  text: string;
  citations: number[];
}

/** Split answer text into text runs and citation markers ([1], [2, 3], [1–3]) for rendering chips. */
export function splitCitations(answer: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  const pattern = /\s?\[(\d+(?:\s*[,;–-]\s*\d+)*)\]/g;
  let cursor = 0;
  for (const match of answer.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: answer.slice(cursor, index), citations: [] });
    const numbers: number[] = [];
    for (const part of (match[1] ?? "").split(/\s*[,;]\s*/)) {
      const range = part.split(/\s*[–-]\s*/).map(Number);
      if (range.length === 2 && range[0] && range[1]) {
        for (let n = range[0]; n <= Math.min(range[1], range[0] + 10); n++) numbers.push(n);
      } else if (range[0]) numbers.push(range[0]);
    }
    const last = segments[segments.length - 1];
    if (last) last.citations.push(...numbers); // markers belong to the text run they follow
    else segments.push({ text: "", citations: numbers });
    cursor = index + match[0].length;
  }
  if (cursor < answer.length) segments.push({ text: answer.slice(cursor), citations: [] });
  return segments;
}
