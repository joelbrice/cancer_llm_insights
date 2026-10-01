import { describe, expect, it } from "vitest";
import {
  AUDIENCES,
  CHECK_ITEMS,
  communityErrorCode,
  REACTION_EMOJI,
  suggestHandle,
  DICTIONARIES,
  LOCALES,
  SseParser,
  StepwellClient,
  addToPlan,
  bmiOption,
  createTranslator,
  evaluateCheck,
  formatReference,
  highlightQuote,
  isoWeek,
  negotiateLocale,
  sortedDesigns,
  sourceLink,
  splitCitations,
  streak,
  toggleCheckin,
} from "../src";
import type { ChatEvent, SourceRef } from "../src";

function keys(obj: unknown, prefix = ""): string[] {
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

describe("i18n", () => {
  it("every locale defines exactly the English keys, with the same placeholders", () => {
    const reference = keys(DICTIONARIES.en).sort();
    for (const locale of LOCALES) {
      expect(keys(DICTIONARIES[locale]).sort()).toEqual(reference);
    }
    const t = createTranslator("en");
    const fr = createTranslator("fr");
    for (const key of reference) {
      const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      // @ts-expect-error dynamic key in test
      expect(placeholders(fr(key, {})), key).toBe(placeholders(t(key, {})));
    }
  });

  it("interpolates params and the brand name", () => {
    const t = createTranslator("fr");
    expect(t("common.sources", { n: 3 })).toBe("3 sources");
    expect(t("home.howTitle")).toBe("Comment fonctionne Stepwell");
  });

  it("negotiates locales", () => {
    expect(negotiateLocale("pt-BR,pt;q=0.9,en;q=0.8")).toBe("pt");
    expect(negotiateLocale("ja,zh;q=0.5")).toBe("en");
    expect(negotiateLocale(["de-AT", "en"])).toBe("de");
  });
});

describe("sse", () => {
  it("parses events split across arbitrary chunk boundaries", () => {
    const stream = 'event: meta\ndata: {"id":"1"}\n\nevent: delta\ndata: {"text":"Hel"}\n\n: keep-alive\n\nevent: delta\r\ndata: {"text":"lo"}\r\n\r\n';
    const parser = new SseParser();
    const events = [];
    for (let i = 0; i < stream.length; i += 7) events.push(...parser.push(stream.slice(i, i + 7)));
    events.push(...parser.end());
    expect(events.map((e) => e.event)).toEqual(["meta", "delta", "delta"]);
    expect(JSON.parse(events[2]!.data)).toEqual({ text: "lo" });
  });

  it("chatStream yields events and resolves with the final response", async () => {
    const frames = [
      'event: meta\ndata: {"id":"r1","language":"en","model":"x","safety":{"level":"none"}}\n\n',
      'event: delta\ndata: {"text":"Hi [1]"}\n\n',
      'event: final\ndata: {"id":"r1","answer":"Hi [1]","citations":[]}\n\n',
      "event: done\ndata: {}\n\n",
    ];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const f of frames) controller.enqueue(new TextEncoder().encode(f));
        controller.close();
      },
    });
    const client = new StepwellClient({
      baseUrl: "http://api",
      fetch: async (url) => {
        expect(url).toBe("http://api/api/v1/chat");
        return new Response(body, { headers: { "content-type": "text/event-stream" } });
      },
    });
    const seen: ChatEvent["type"][] = [];
    const final = await client.chatStream({ messages: [{ role: "user", content: "hi" }] }, (e) => seen.push(e.type));
    expect(seen).toEqual(["meta", "delta", "final", "done"]);
    expect(final.answer).toBe("Hi [1]");
  });

  it("maps API errors", async () => {
    const client = new StepwellClient({
      baseUrl: "",
      fetch: async () => new Response(JSON.stringify({ error: { code: 429, message: "rate limit exceeded" } }), { status: 429 }),
    });
    await expect(client.status()).rejects.toMatchObject({ status: 429, isRateLimited: true });
  });
});

describe("evidence helpers", () => {
  const source: SourceRef = {
    document_id: "d", title: "Physical activity and cancer.", authors: ["A A", "B B", "C C", "D D"], year: 2020,
    journal: "J Test", publisher: null, doi: "10.1/x", pmid: null, url: null, source_type: "meta_analysis",
    source_type_label: "Meta-analysis", credibility: "peer_reviewed", credibility_label: "Peer-reviewed",
    quality_score: 0.9, language: "en", license: null,
  };

  it("formats Vancouver references and links", () => {
    expect(formatReference(source)).toBe("A A, B B, C C, et al. Physical activity and cancer. J Test. 2020. doi:10.1/x");
    expect(sourceLink(source)).toBe("https://doi.org/10.1/x");
    expect(sourceLink({ doi: null, pmid: null, url: "javascript:alert(1)" })).toBeNull();
  });

  it("splits citation markers", () => {
    expect(splitCitations("Exercise helps [1]. Alcohol harms [2, 3][4]. Range [5–6].")).toEqual([
      { text: "Exercise helps", citations: [1] },
      { text: ". Alcohol harms", citations: [2, 3, 4] },
      { text: ". Range", citations: [5, 6] },
      { text: ".", citations: [] },
    ]);
  });

  it("highlights quotes by offsets, falling back to search", () => {
    const passage = "First sentence. The quote is here. Last.";
    expect(highlightQuote({ passage, quote: "The quote is here.", quote_start: 16, quote_end: 34 })[1]).toBe("The quote is here.");
    expect(highlightQuote({ passage, quote: "Last.", quote_start: 0, quote_end: 0 })).toEqual(["First sentence. The quote is here. ", "Last.", ""]);
  });

  it("orders designs by the evidence pyramid", () => {
    expect(sortedDesigns({ blog: 1, cohort: 2, meta_analysis: 1 }).map((d) => d.id)).toEqual(["meta_analysis", "cohort", "blog"]);
  });
});

describe("lifestyle check & plan", () => {
  it("every item is fully translated and evaluates locally", () => {
    for (const item of CHECK_ITEMS) {
      for (const locale of LOCALES) {
        expect(item.question[locale]).toBeTruthy();
        expect(item.advice[locale]).toBeTruthy();
        for (const option of item.options) expect(option.label[locale]).toBeTruthy();
      }
    }
    const result = evaluateCheck({ tobacco: "daily", alcohol: "none", activity: "60-149", unknown: "x" });
    expect(result.answered).toBe(3);
    expect(result.items[0]!.status).toBe("not_aligned");
    expect(result.counts).toEqual({ aligned: 1, partly: 1, not_aligned: 1, info: 0 });
  });

  it("computes BMI categories", () => {
    expect(bmiOption(170, 65)).toBe("healthy");
    expect(bmiOption(170, 80)).toBe("overweight");
    expect(bmiOption(170, 95)).toBe("obesity");
    expect(bmiOption(0, 70)).toBeNull();
  });

  it("tracks weekly check-ins and streaks", () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe("2026-W01");
    expect(isoWeek(new Date(2024, 11, 30))).toBe("2025-W01");
    let plan = addToPlan([], { insightId: "i.en", insightTitle: "T", text: "Walk", evidenceLevel: "high" });
    plan = addToPlan(plan, { insightId: "i.en", insightTitle: "T", text: "Walk", evidenceLevel: "high" });
    expect(plan).toHaveLength(1);
    const id = plan[0]!.id;
    for (const w of ["2026-W38", "2026-W39", "2026-W40"]) plan = toggleCheckin(plan, id, w);
    expect(streak(plan[0]!, "2026-W40")).toBe(3);
    expect(streak(plan[0]!, "2026-W41")).toBe(3);
    expect(streak(plan[0]!, "2026-W43")).toBe(0);
  });
});

describe("community", () => {
  it("sends the member token and country only on community calls, and surfaces moderation error codes", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/community/posts") && init?.method === "POST")
        return new Response(JSON.stringify({ error: { code: 422, message: "contact_details" } }), { status: 422 });
      return new Response(JSON.stringify({ items: [], next_cursor: null }), { status: 200 });
    };
    const client = new StepwellClient({ baseUrl: "https://api.example.org/", fetch: fetcher });
    await client.community.feed("tok", { circle: "prevention", cursor: null });
    expect(calls[0]!.url).toBe("https://api.example.org/api/v1/community/posts?circle=prevention");
    expect((calls[0]!.init!.headers as Record<string, string>)["X-Member-Token"]).toBe("tok");
    const error = await client.community.post("tok", { circle: "prevention", kind: "win", body: "call 0612345678" }, "FR").catch((e) => e);
    expect(communityErrorCode(error.message)).toBe("contact_details");
    expect((calls[1]!.init!.headers as Record<string, string>)["X-Country"]).toBe("FR");
    await client.status().catch(() => undefined);
    expect((calls[2]!.init!.headers as Record<string, string>)["X-Member-Token"]).toBeUndefined();
  });

  it("suggests friendly, localised pseudonyms", () => {
    let i = 0;
    const seq = [0.1, 0.5, 0.99];
    const handle = suggestHandle("fr", () => seq[i++ % seq.length]!);
    expect(handle).toMatch(/^\p{L}+ \p{L}+ \d{2}$/u);
    expect(AUDIENCES).toEqual(["prevention", "in_treatment", "after_treatment", "caregivers"]);
    expect(Object.keys(REACTION_EMOJI)).toEqual(["support", "strength", "thanks", "inspired"]);
  });
});
