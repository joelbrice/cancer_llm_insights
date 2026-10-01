/** Community helpers shared by web and mobile. */
import type { Locale, PostKind, ReactionKind } from "./types";

/** Supportive reactions only — there is deliberately no "dislike". */
export const REACTION_EMOJI: Record<ReactionKind, string> = {
  support: "💛",
  strength: "💪",
  thanks: "🙏",
  inspired: "🌱",
};

export const POST_KINDS: readonly PostKind[] = ["win", "encouragement", "question", "tip"] as const;

/** Error codes returned by the community API that the UI explains to the person. */
export const COMMUNITY_ERRORS = [
  "consent_required",
  "handle_taken",
  "handle_format",
  "handle_contact",
  "handle_reserved",
  "handle_abuse",
  "contact_details",
  "links",
  "slow_down",
  "member_suspended",
  "member_banned",
] as const;
export type CommunityErrorCode = (typeof COMMUNITY_ERRORS)[number];

export function communityErrorCode(message: string | undefined | null): CommunityErrorCode | null {
  return COMMUNITY_ERRORS.find((code) => code === message) ?? null;
}

const WORDS: Record<Locale, { a: string[]; n: string[] }> = {
  en: { a: ["Brave", "Calm", "Bright", "Gentle", "Steady", "Hopeful", "Kind", "Quiet", "Warm", "Bold"], n: ["Willow", "Harbor", "Sparrow", "Cedar", "River", "Meadow", "Lantern", "Maple", "Juniper", "Robin"] },
  fr: { a: ["Brave", "Calme", "Doux", "Lumineux", "Serein", "Fidèle", "Tenace", "Clair", "Joyeux", "Vif"], n: ["Saule", "Rivage", "Moineau", "Cèdre", "Ruisseau", "Prairie", "Lanterne", "Érable", "Genêt", "Merle"] },
  es: { a: ["Valiente", "Sereno", "Brillante", "Amable", "Firme", "Alegre", "Tenaz", "Claro", "Cálido", "Fiel"], n: ["Sauce", "Puerto", "Gorrión", "Cedro", "Río", "Prado", "Farol", "Arce", "Enebro", "Mirlo"] },
  pt: { a: ["Corajoso", "Sereno", "Brilhante", "Gentil", "Firme", "Alegre", "Tenaz", "Claro", "Caloroso", "Fiel"], n: ["Salgueiro", "Porto", "Pardal", "Cedro", "Rio", "Prado", "Lanterna", "Bordo", "Zimbro", "Melro"] },
  de: { a: ["Mutig", "Ruhig", "Hell", "Sanft", "Stetig", "Froh", "Treu", "Klar", "Warm", "Kühn"], n: ["Weide", "Hafen", "Spatz", "Zeder", "Fluss", "Wiese", "Laterne", "Ahorn", "Wacholder", "Amsel"] },
};

/** A friendly pseudonym suggestion, e.g. "Calm Willow 27". Never derived from personal data. */
export function suggestHandle(locale: Locale, random: () => number = Math.random): string {
  const { a, n } = WORDS[locale] ?? WORDS.en;
  const pick = (list: string[]) => list[Math.floor(random() * list.length) % list.length]!;
  return `${pick(a)} ${pick(n)} ${10 + Math.floor(random() * 90)}`;
}

/** "3 h ago" in the reader's language; falls back to a date after a week or where Intl.RelativeTimeFormat is missing. */
export function relativeTime(locale: Locale, iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);
  const RTF = (Intl as unknown as { RelativeTimeFormat?: typeof Intl.RelativeTimeFormat }).RelativeTimeFormat;
  if (!RTF || abs >= 7 * 86_400) {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(then);
  }
  const rtf = new RTF(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(0, "second"); // "now"
  if (abs < 3_600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3_600), "hour");
  return rtf.format(Math.round(seconds / 86_400), "day");
}
