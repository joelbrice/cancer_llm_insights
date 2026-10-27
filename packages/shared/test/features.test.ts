import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_QUESTIONS,
  DICTIONARIES,
  EMPTY_APPOINTMENT,
  EMPTY_SYNC_PAYLOAD,
  StepwellClient,
  addCustomQuestion,
  base64url,
  buildWeeklyIcs,
  createTranslator,
  decryptPayload,
  deriveSyncKeys,
  downloadOfflinePack,
  encryptPayload,
  formatQuestionList,
  fromBase64url,
  generateSyncCode,
  insightSpeech,
  mergePayloads,
  mergeSets,
  moveQuestion,
  nextOccurrence,
  normalizeSyncCode,
  questionGroups,
  removeQuestion,
  setNote,
  speakable,
  speechChunks,
  syncOnce,
  toggleQuestion,
  utf8,
  fromUtf8,
  weekdayNames,
} from "../src";
import type { Insight, PlanItem, SyncPayload, SyncState } from "../src";

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function item(id: string, checkins: string[] = []): PlanItem {
  return { id, insightId: "x.en", insightTitle: "X", text: `do ${id}`, evidenceLevel: "high", addedAt: "2026-01-01", checkins };
}

describe("encrypted sync", () => {
  it("creates readable codes and tolerates typing variations", () => {
    const code = generateSyncCode(random);
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normalizeSyncCode(code.toLowerCase().replace(/-/g, " "))).toBe(code);
    expect(normalizeSyncCode(code.replace(/0/g, "O").replace(/1/g, "l"))).toBe(code);
    expect(normalizeSyncCode("too-short")).toBeNull();
    expect(normalizeSyncCode(`${code.slice(0, -1)}U`)).toBeNull(); // U is not in the alphabet
  });

  it("derives independent id, write secret and key deterministically", () => {
    const code = generateSyncCode(random);
    const a = deriveSyncKeys(code);
    const b = deriveSyncKeys(code.toLowerCase());
    expect(a.id).toMatch(/^[0-9a-f]{64}$/);
    expect(a.auth).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([b.id, b.auth]).toEqual([a.id, a.auth]);
    expect(Array.from(b.key)).toEqual(Array.from(a.key));
    expect(deriveSyncKeys(generateSyncCode(random)).id).not.toBe(a.id);
  });

  it("encrypts so the server cannot read it, and detects tampering", () => {
    const keys = deriveSyncKeys(generateSyncCode(random));
    const payload: SyncPayload = { v: 1, plan: [item("p1", ["2026-W40"])], profile: { country: "PT", audience: "after_treatment" }, questions: null };
    const sealed = encryptPayload(keys, payload, random);
    // Not the plaintext in another encoding. (A two-letter check such as "PT" matches random base64 ~8% of the time.)
    const plain = base64url(utf8(JSON.stringify(payload)));
    for (let i = 0; i + 16 <= plain.length; i += 16) expect(sealed).not.toContain(plain.slice(i, i + 16));
    expect(sealed).not.toContain("after_treatment");
    expect(decryptPayload(keys, sealed)).toEqual(payload);
    const raw = fromBase64url(sealed);
    raw[raw.length - 1]! ^= 1; // flip one bit of the authentication tag
    expect(() => decryptPayload(keys, base64url(raw))).toThrow();
    expect(() => decryptPayload(deriveSyncKeys(generateSyncCode(random)), sealed)).toThrow();
  });

  it("round-trips UTF-8 without TextEncoder", () => {
    for (const text of ["café", "日本語", "مرحبا", "emoji 💪🏽"]) expect(fromUtf8(utf8(text))).toBe(text);
  });

  it("merges three-way: removals stick, check-ins from both devices are kept", () => {
    expect(mergeSets(["a", "b"], ["a", "c"], ["a", "b", "d"])).toEqual(["a", "c", "d"]);
    const base: SyncPayload = { ...EMPTY_SYNC_PAYLOAD, plan: [item("keep", ["W1"]), item("gone")] };
    const local: SyncPayload = { ...base, plan: [item("keep", ["W1", "W2"])], profile: { country: "FR" } };
    const remote: SyncPayload = { ...base, plan: [item("keep", ["W1", "W3"]), item("gone"), item("new")] };
    const merged = mergePayloads(base, local, remote);
    expect(merged.plan.map((p) => p.id)).toEqual(["keep", "new"]);
    expect(merged.plan[0]!.checkins).toEqual(["W1", "W2", "W3"]);
    expect(merged.profile).toEqual({ country: "FR" });
    const unchangedLocal = mergePayloads(base, base, { ...base, profile: { country: "DE" } });
    expect(unchangedLocal.profile).toEqual({ country: "DE" });
  });

  it("syncs two devices through an opaque store, retrying after a concurrent write", async () => {
    const store = new Map<string, { ciphertext: string; version: number; auth: string }>();
    let conflictOnce = true;
    const fetcher = async (url: string, init?: RequestInit): Promise<Response> => {
      const id = url.split("/sync/")[1]!;
      const auth = new Headers(init?.headers).get("authorization")?.slice(7) ?? "";
      const row = store.get(id);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      if (init?.method === "GET") return row && row.auth === auth ? json({ ...row, updated_at: "now" }) : json({ error: { message: "not_found" } }, 404);
      const body = JSON.parse(String(init?.body)) as { ciphertext: string; version: number };
      if (conflictOnce && row) {
        conflictOnce = false;
        store.set(id, { ...row, version: row.version + 1 }); // someone else wrote in between
        return json({ error: { message: "version_conflict" } }, 409);
      }
      if ((row?.version ?? 0) !== body.version) return json({ error: { message: "version_conflict" } }, 409);
      const next = { ciphertext: body.ciphertext, version: body.version + 1, auth };
      store.set(id, next);
      return json({ ciphertext: "", version: next.version, updated_at: "now" });
    };
    const api = new StepwellClient({ baseUrl: "http://api", fetch: fetcher });
    const code = generateSyncCode(random);
    const phone: SyncState = { code, version: 0, base: null, last_synced_at: null };
    const first = await syncOnce(api, phone, { ...EMPTY_SYNC_PAYLOAD, plan: [item("walk", ["W1"])] }, random);
    expect(first.state.version).toBe(1);
    expect([...store.values()][0]!.ciphertext).not.toContain("walk");

    const laptop: SyncState = { code, version: 0, base: null, last_synced_at: null };
    const second = await syncOnce(api, laptop, { ...EMPTY_SYNC_PAYLOAD, plan: [item("veg")] }, random);
    expect(second.changedLocal).toBe(true);
    expect(second.payload.plan.map((p) => p.id).sort()).toEqual(["veg", "walk"]);
    expect(second.state.version).toBe(3); // 1 → conflict bumped to 2 → merged write 3

    store.clear(); // turned off on another device: this one stops instead of re-uploading
    const third = await syncOnce(api, second.state, second.payload, random);
    expect(third.stopped).toBe(true);
    expect(store.size).toBe(0);
  });
});

describe("appointment questions", () => {
  const t = createTranslator("en");

  it("every bank question is translated in every language", () => {
    const ids = Object.values(APPOINTMENT_QUESTIONS).flat();
    expect(new Set(ids).size).toBe(ids.length);
    for (const dict of Object.values(DICTIONARIES)) {
      const bank = (dict as { appointment: { q: Record<string, string> } }).appointment.q;
      expect(Object.keys(bank).sort()).toEqual([...ids].sort());
    }
  });

  it("orders groups by journey and builds a printable list", () => {
    expect(questionGroups("in_treatment").slice(0, 2)).toEqual(["in_treatment", "general"]);
    expect(questionGroups(null)[0]).toBe("general");
    let state = toggleQuestion(EMPTY_APPOINTMENT, "t_goal");
    state = addCustomQuestion(state, "  Can I travel   in May? ");
    state = addCustomQuestion(state, "can i travel in may?"); // same question: not duplicated
    expect(state.custom).toHaveLength(1);
    const custom = state.custom[0]!.id;
    state = setNote(state, "t_goal", "Cure is the aim");
    state = moveQuestion(state, custom, -1);
    expect(state.selected).toEqual([custom, "t_goal"]);
    const text = formatQuestionList(t, state, new Date(2026, 9, 8), "en");
    expect(text).toContain("1. Can I travel in May?");
    expect(text).toContain("2. What is the aim of my treatment");
    expect(text).toContain("Notes: Cure is the aim");
    state = removeQuestion(state, "t_goal");
    expect(state.notes).toEqual({});
    expect(toggleQuestion(state, custom).selected).toEqual([]);
  });
});

describe("weekly reminder", () => {
  it("finds the next occurrence in local time", () => {
    const wed = new Date(2026, 9, 7, 12, 0); // Wednesday
    expect(nextOccurrence({ enabled: true, weekday: 7, hour: 18, minute: 0 }, wed).getDate()).toBe(11);
    expect(nextOccurrence({ enabled: true, weekday: 3, hour: 18, minute: 0 }, wed).getDate()).toBe(7);
    expect(nextOccurrence({ enabled: true, weekday: 3, hour: 9, minute: 0 }, wed).getDate()).toBe(14);
  });

  it("builds a valid weekly calendar event with folded, escaped lines", () => {
    const ics = buildWeeklyIcs({
      prefs: { enabled: true, weekday: 7, hour: 18, minute: 30 },
      title: "How did your plan go this week?",
      description: "Tick off what you did, then rest; small steps count, really — every single one of them, always.",
      url: "https://stepwell.example/en/plan",
      app: "Stepwell",
      now: new Date(2026, 9, 7, 12, 0),
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU");
    expect(ics).toContain("DTSTART:20261011T183000");
    expect(ics).toContain("rest\\; small steps count\\,");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("names weekdays in every language, Monday first", () => {
    expect(weekdayNames("en")[0]).toBe("Monday");
    expect(weekdayNames("fr")[6]).toBe("dimanche");
  });
});

describe("read-aloud", () => {
  it("drops citation markers and splits into short chunks", () => {
    expect(speakable("Walking helps [1, 2]. It lowers risk [3–5].")).toBe("Walking helps. It lowers risk.");
    const chunks = speechChunks("One. ".repeat(100), 50);
    expect(chunks.every((c) => c.length <= 50)).toBe(true);
    expect(chunks.join(" ").split("One.").length - 1).toBe(100);
    const insight = {
      title: "Quitting smoking", summary: "It helps at any age [1]", key_points: [{ text: "Risk falls [2]" }],
      recommendations: [], limitations: [],
    } as unknown as Insight;
    const speech = insightSpeech(insight, createTranslator("en"));
    expect(speech).toContain("Quitting smoking. It helps at any age. What the evidence says. Risk falls.");
    expect(speech).not.toMatch(/\[\d/);
  });
});

describe("offline packs", () => {
  it("downloads every published insight in one language", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string): Promise<Response> => {
      calls.push(url);
      const body = url.includes("/insights?")
        ? { items: [{ id: "a.en" }, { id: "b.en" }], total: 2, page: 1, page_size: 100 }
        : { id: url.split("/insights/")[1], title: "T" };
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const progress: number[] = [];
    const pack = await downloadOfflinePack(new StepwellClient({ baseUrl: "", fetch: fetcher }), "en", (d) => progress.push(d));
    expect(Object.keys(pack.insights).sort()).toEqual(["a.en", "b.en"]);
    expect(progress.at(-1)).toBe(2);
    expect(calls[0]).toContain("lang=en");
  });
});
