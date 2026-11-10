export type LegalPageId = "privacy" | "terms" | "imprint" | "accessibility";

/** A section of a legal page. Each entry of `p` is a paragraph; entries starting with "• " are list items, and
 * consecutive items form one list. Placeholders such as {operator} are filled from the operator's details. */
export interface LegalSection {
  h: string;
  p: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export type LegalTexts = Record<LegalPageId, LegalDoc>;

/** GET /api/v1/legal: who runs this deployment, set by the operator (LEGAL_* settings). */
export interface LegalInfo {
  operator: {
    name: string | null;
    address: string[] | null;
    email: string | null;
    phone: string | null;
    representative: string | null;
    register: string | null;
    vat_id: string | null;
    content_responsible: string | null;
    dpo: string | null;
    supervisory_authority: string | null;
    hosting: string | null;
    accessibility_authority: string | null;
  };
  effective_date: string | null;
  /** Counsel has approved the texts: no draft notice, and optional details that do not apply are left out. */
  approved: boolean;
  /** Required details that are still empty. */
  missing: string[];
}
