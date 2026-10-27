import { brandName } from "../brand";
import { formatDate, localeDirection, type MessageKey, type Translate } from "../i18n";
import type { Locale } from "../types";
import { ar } from "./ar";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { pt } from "./pt";
import type { LegalInfo, LegalPageId, LegalTexts } from "./types";

export type * from "./types";

/** Privacy policy, terms of use, legal notice (Impressum) and accessibility statement. */
export const LEGAL_PAGES: readonly LegalPageId[] = ["privacy", "terms", "imprint", "accessibility"] as const;

export const LEGAL_TEXTS: Record<Locale, LegalTexts> = { en, fr, es, pt, de, it, ar };

/** Placeholders in the texts and where their values come from (GET /api/v1/legal). {app} is the brand name. */
const FIELDS = {
  operator: "name",
  address: "address",
  email: "email",
  phone: "phone",
  representative: "representative",
  register: "register",
  vatId: "vat_id",
  contentResponsible: "content_responsible",
  dpo: "dpo",
  authority: "supervisory_authority",
  hosting: "hosting",
  accessibilityAuthority: "accessibility_authority",
  date: "effective_date",
} as const;
export type LegalPlaceholder = keyof typeof FIELDS;
export const LEGAL_PLACEHOLDERS = Object.keys(FIELDS) as LegalPlaceholder[];

/** Details that do not apply to every operator (a register entry only for companies, a data protection officer only
 * when one is required). Once counsel has approved the texts, lines that use an empty one are left out. */
const OPTIONAL: ReadonlySet<LegalPlaceholder> = new Set([
  "phone",
  "representative",
  "register",
  "vatId",
  "dpo",
  "accessibilityAuthority",
]);

export function isLegalPage(value: unknown): value is LegalPageId {
  return typeof value === "string" && (LEGAL_PAGES as readonly string[]).includes(value);
}

export type LegalBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };

export interface RenderedLegal {
  page: LegalPageId;
  title: string;
  intro: string;
  sections: { h: string; blocks: LegalBlock[] }[];
  /** Not yet approved by counsel: show the draft notice. */
  draft: boolean;
  /** Formatted date of the current version, if set. */
  date: string | null;
  dir: "ltr" | "rtl";
}

function fieldValue(info: LegalInfo | null, name: LegalPlaceholder, locale: Locale): string | null {
  if (!info) return null;
  if (name === "date") return info.effective_date ? formatDate(locale, info.effective_date, "long") : null;
  const raw = info.operator[FIELDS[name] as keyof LegalInfo["operator"]];
  if (Array.isArray(raw)) return raw.length ? raw.join(", ") : null;
  return raw?.trim() || null;
}

/** A legal page in the reader's language, with the operator's details filled in. Missing details are shown as
 * visible "to be completed" markers until counsel approves the texts. */
export function renderLegal(locale: Locale, page: LegalPageId, info: LegalInfo | null, t: Translate): RenderedLegal {
  const doc = (LEGAL_TEXTS[locale] ?? LEGAL_TEXTS.en)[page];
  const approved = info?.approved === true;
  const dir = localeDirection(locale);
  // Names and addresses are usually written left to right: isolate them inside right-to-left text.
  const isolate = (value: string) => (dir === "rtl" ? `⁨${value}⁩` : value);

  const fill = (template: string): string | null => {
    let drop = false;
    const text = template.replace(/\{(\w+)\}/g, (match, name: string) => {
      if (name === "app") return brandName();
      if (!(name in FIELDS)) return match;
      const key = name as LegalPlaceholder;
      const value = fieldValue(info, key, locale);
      if (value) return isolate(value);
      if (approved && OPTIONAL.has(key)) {
        drop = true;
        return "";
      }
      return isolate(t("legal.missing", { field: t(`legal.fields.${key}` as MessageKey) }));
    });
    return drop ? null : text;
  };

  const sections = doc.sections
    .map((section) => {
      const blocks: LegalBlock[] = [];
      for (const paragraph of section.p) {
        const text = fill(paragraph);
        if (text === null) continue;
        if (text.startsWith("• ")) {
          const last = blocks[blocks.length - 1];
          if (last?.type === "ul") last.items.push(text.slice(2));
          else blocks.push({ type: "ul", items: [text.slice(2)] });
        } else {
          blocks.push({ type: "p", text });
        }
      }
      return { h: fill(section.h) ?? section.h, blocks };
    })
    .filter((section) => section.blocks.length > 0);

  return {
    page,
    title: fill(doc.title) ?? doc.title,
    intro: fill(doc.intro) ?? "",
    sections,
    draft: !approved,
    date: fieldValue(info, "date", locale),
    dir,
  };
}
