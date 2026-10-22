import { describe, expect, it } from "vitest";

import {
  LEGAL_PAGES,
  LEGAL_PLACEHOLDERS,
  LEGAL_TEXTS,
  LOCALES,
  createTranslator,
  renderLegal,
  type LegalInfo,
} from "../src";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const FILLED: LegalInfo = {
  operator: {
    name: "Stepwell gGmbH",
    address: ["Musterstraße 1", "10115 Berlin", "Germany"],
    email: "hello@example.org",
    phone: null,
    representative: "A. Example",
    register: null,
    vat_id: null,
    content_responsible: "A. Example, Musterstraße 1, 10115 Berlin",
    dpo: null,
    supervisory_authority: "Berliner Beauftragte für Datenschutz und Informationsfreiheit",
    hosting: "Hosting: Example Cloud, Frankfurt (EU)",
    accessibility_authority: null,
  },
  effective_date: "2026-11-01",
  approved: true,
  missing: [],
};

describe("legal pages", () => {
  it("every language has the same sections, paragraphs, lists and placeholders as English", () => {
    const known = new Set<string>([...LEGAL_PLACEHOLDERS, "app"]);
    for (const page of LEGAL_PAGES) {
      const master = LEGAL_TEXTS.en[page];
      for (const locale of LOCALES) {
        const doc = LEGAL_TEXTS[locale][page];
        const where = `${locale}/${page}`;
        expect(doc.title.length, where).toBeGreaterThan(3);
        expect(placeholders(doc.intro), `${where} intro`).toEqual(placeholders(master.intro));
        expect(doc.sections.length, where).toBe(master.sections.length);
        doc.sections.forEach((section, i) => {
          const ref = master.sections[i]!;
          expect(placeholders(section.h), `${where} §${i} heading`).toEqual(placeholders(ref.h));
          expect(section.p.length, `${where} §${i}`).toBe(ref.p.length);
          section.p.forEach((paragraph, j) => {
            expect(placeholders(paragraph), `${where} §${i}.${j}`).toEqual(placeholders(ref.p[j]!));
            expect(paragraph.startsWith("• "), `${where} §${i}.${j} list item`).toBe(ref.p[j]!.startsWith("• "));
            for (const name of placeholders(paragraph)) expect(known.has(name!), `${where}: {${name}}`).toBe(true);
          });
        });
        if (locale !== "en") expect(JSON.stringify(doc), `${where} is translated`).not.toBe(JSON.stringify(master));
      }
    }
  });

  it("follows French typography", () => {
    const text = JSON.stringify(LEGAL_TEXTS.fr);
    expect(text).not.toMatch(/ [:;?!»]/);
    expect(text).not.toMatch(/« /);
  });

  it("shows a draft notice and visible markers until the details are filled in and approved", () => {
    const t = createTranslator("en");
    const draft = renderLegal("en", "imprint", null, t);
    expect(draft.draft).toBe(true);
    const text = JSON.stringify(draft);
    expect(text).toContain("[operator name: to be completed]");
    expect(text).toContain("[phone number: to be completed]");
    expect(text).not.toMatch(/\{\w+\}/);
  });

  it("fills in the operator and leaves out details that do not apply once approved", () => {
    const t = createTranslator("de");
    const imprint = renderLegal("de", "imprint", FILLED, t);
    const text = JSON.stringify(imprint);
    expect(imprint.draft).toBe(false);
    expect(text).toContain("Stepwell gGmbH");
    expect(text).toContain("Musterstraße 1, 10115 Berlin, Germany");
    expect(text).not.toContain("Telefon:"); // no phone number given: the line is left out
    expect(imprint.sections.map((s) => s.h)).not.toContain("Register und Umsatzsteuer"); // nothing left in it
    expect(text).not.toContain("noch zu ergänzen");
    expect(text).not.toMatch(/\{\w+\}/);
    const privacy = renderLegal("de", "privacy", FILLED, t);
    expect(JSON.stringify(privacy)).not.toContain("Datenschutzbeauftragte"); // no DPO appointed
    expect(privacy.date).toBe("1. November 2026");
  });

  it("keeps required details visible even when approved", () => {
    const info: LegalInfo = { ...FILLED, operator: { ...FILLED.operator, email: null } };
    const text = JSON.stringify(renderLegal("en", "imprint", info, createTranslator("en")));
    expect(text).toContain("[email address: to be completed]");
  });

  it("groups list items and isolates inserted names in Arabic", () => {
    const privacy = renderLegal("ar", "privacy", FILLED, createTranslator("ar"));
    expect(privacy.dir).toBe("rtl");
    const community = privacy.sections[5]!;
    expect(community.blocks.filter((b) => b.type === "ul")).toHaveLength(1);
    expect(community.blocks.find((b) => b.type === "ul")).toMatchObject({ type: "ul", items: expect.arrayContaining([expect.any(String)]) });
    expect(JSON.stringify(privacy)).toContain("⁨Stepwell gGmbH⁩");
    const en = renderLegal("en", "privacy", FILLED, createTranslator("en"));
    expect(JSON.stringify(en)).not.toContain("⁨");
  });
});
