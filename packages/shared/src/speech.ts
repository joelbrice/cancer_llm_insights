/**
 * Audio read-aloud (roadmap 1.2): the text to speak for an insight, cleaned of citation markers and split into
 * sentence-sized chunks (long utterances are cut off by some speech engines). Speaking itself is per platform:
 * the Web Speech API on the web, expo-speech on mobile. Everything happens on the device.
 */
import type { Translate } from "./i18n";
import type { Insight } from "./types";

const CITATION = /\s*\[(?:\d+(?:\s*[,–-]\s*\d+)*)\]/g;

export function speakable(text: string): string {
  return text.replace(CITATION, "").replace(/\s+/g, " ").trim();
}

/** Title, summary, what the evidence says, what you can do, and the limits — in reading order. */
export function insightSpeech(insight: Insight, t: Translate): string {
  const parts: string[] = [insight.title, insight.summary];
  if (insight.key_points.length) parts.push(t("insights.keyPoints"), ...insight.key_points.map((p) => p.text));
  if (insight.recommendations.length) parts.push(t("insights.recommendations"), ...insight.recommendations.map((p) => p.text));
  if (insight.limitations.length) parts.push(t("insights.limitations"), ...insight.limitations);
  parts.push(t("disclaimer.short"));
  return parts.map((p) => speakable(p)).filter(Boolean).map((p) => (/[.!?…:;。؟]$/.test(p) ? p : `${p}.`)).join(" ");
}

/** Sentence-sized chunks of at most `max` characters (never splits a word). */
export function speechChunks(text: string, max = 220): string[] {
  const sentences = text.match(/[^.!?…؟]+[.!?…؟]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length <= max) {
      current += sentence;
      continue;
    }
    if (current.trim()) chunks.push(current.trim());
    current = "";
    if (sentence.length <= max) {
      current = sentence;
      continue;
    }
    for (const word of sentence.split(/\s+/)) {
      if ((current + " " + word).trim().length > max && current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      current = `${current} ${word}`;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** BCP-47 tag to ask the speech engine for (it picks the best installed voice for that language). */
export function speechLanguage(locale: string): string {
  const tags: Record<string, string> = {
    en: "en-GB", fr: "fr-FR", es: "es-ES", pt: "pt-PT", de: "de-DE", it: "it-IT", ar: "ar",
  };
  return tags[locale] ?? locale;
}
