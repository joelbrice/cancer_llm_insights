import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "./fixtures";
import { join, postText, unique } from "./helpers";

const INSIGHT = "/en/insights/quitting-smoking.en";

test("appointment questions: pick, add your own, take notes, and keep them on this device", async ({ page, errors }) => {
  await page.goto("/en/appointment");
  await expect(page.getByRole("heading", { level: 1, name: "Questions for your appointment" })).toBeVisible();
  await expect(page.getByText("They are not medical advice")).toBeVisible();
  await page.getByLabel("Who should I contact if I have questions between appointments?").check();
  await expect(page.getByRole("heading", { name: "Your list (1)" })).toBeVisible();

  const own = page.getByLabel("Add your own question");
  await expect(async () => {
    await own.fill("Can I travel in May?");
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeEnabled({ timeout: 1000 });
  }).toPass();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your list (2)" })).toBeVisible();
  await page.getByPlaceholder("Write the answer here").first().fill("Call the day unit first");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your list (2)" })).toBeVisible();
  await expect(page.getByPlaceholder("Write the answer here").first()).toHaveValue("Call the day unit first");
  await page.getByRole("button", { name: "Move up: Can I travel in May?" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Can I travel in May?" }).first()).toContainText("1.");

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear my list" }).click();
  await expect(page.getByText("Your list is empty")).toBeVisible();
  expect(errors).toEqual([]);
});

test("an insight adds a question about itself to the appointment list", async ({ page }) => {
  await page.goto(INSIGHT);
  await page.getByRole("button", { name: "Add a question for my appointment" }).click();
  await page.getByRole("link", { name: "Added to your appointment questions" }).click();
  await expect(page).toHaveURL(/\/en\/appointment$/);
  await expect(page.getByText(/What does the research on “.+” mean for me\?/).first()).toBeVisible();
});

test("read-aloud speaks the insight without citation markers", async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    class Utterance {
      text: string;
      lang = "";
      rate = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: (u: Utterance) => {
          spoken.push(u.text);
          setTimeout(() => u.onend?.(), 20);
        },
        cancel: () => undefined,
        pause: () => undefined,
        resume: () => undefined,
        getVoices: () => [],
      },
    });
  });
  await page.goto(INSIGHT);
  await page.getByRole("button", { name: "Listen" }).click();
  await expect(page.getByRole("button", { name: "Listen" })).toBeVisible(); // back to idle once every chunk is spoken
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.join(" "));
  expect(spoken).toContain("What the evidence says");
  expect(spoken).toContain("not medical advice");
  expect(spoken).not.toMatch(/\[\d/);
});

test("weekly reminder downloads a recurring calendar event", async ({ page }) => {
  await page.goto("/en/plan");
  await page.getByLabel("Day").selectOption({ label: "Sunday" });
  await page.getByLabel("Time").fill("18:30");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to my calendar" }).click();
  const file = await (await download).path();
  const ics = await readFile(file, "utf8");
  expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU");
  expect(ics).toMatch(/DTSTART:\d{8}T183000/);
  expect(ics).toContain("SUMMARY:How did your plan go this week?");
});

async function syncCode(page: Page): Promise<string> {
  await expect(page.getByRole("button", { name: "Hide code" })).toBeVisible(); // shown right after turning sync on
  const code = (await page.locator("code").filter({ hasText: /^[0-9A-Z]{4}-/ }).textContent())!.trim();
  expect(code).toMatch(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
  return code;
}

test("end-to-end-encrypted sync carries the plan to another device, and turning it off stops both", async ({ page, browser }) => {
  await page.goto(INSIGHT);
  await page.getByRole("button", { name: "Add to my plan" }).first().click();
  await page.goto("/en/profile");
  await page.getByRole("button", { name: "Turn on sync" }).click();
  await expect(page.getByText(/^Last synced/)).toBeVisible();
  const code = await syncCode(page);

  const ctx = await browser.newContext();
  const laptop = await ctx.newPage();
  await laptop.addInitScript(() => localStorage.setItem("stepwell.welcome.v1", "true"));
  await laptop.goto("/en/profile");
  await laptop.getByRole("button", { name: "I have a code from another device" }).click();
  await laptop.getByLabel("Sync code from your other device").fill(code.toLowerCase().replace(/-/g, " "));
  await laptop.getByRole("button", { name: "Connect" }).click();
  await expect(laptop.getByText(/^Last synced/)).toBeVisible();
  await laptop.goto("/en/plan");
  const box = laptop.getByRole("checkbox").first();
  await expect(box).toBeVisible();
  await box.check(); // a check-in on the laptop…

  await laptop.goto("/en/profile");
  await laptop.getByRole("button", { name: "Sync now" }).click();
  await expect(laptop.getByText(/^Last synced/)).toBeVisible();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText(/^Last synced/)).toBeVisible();
  await page.goto("/en/plan");
  await expect(page.getByRole("checkbox").first()).toBeChecked(); // …reaches the phone

  laptop.on("dialog", (d) => d.accept());
  await laptop.getByRole("button", { name: "Turn off sync" }).click();
  await expect(laptop.getByRole("button", { name: "Turn on sync" })).toBeVisible();
  await page.goto("/en/profile");
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByRole("button", { name: "Turn on sync" })).toBeVisible(); // stopped here too…
  await page.goto("/en/plan"); // …and the plan stays on the device
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await ctx.close();
});

test("the transparency report is public and shows only aggregates", async ({ page }) => {
  await page.goto("/en/transparency");
  await expect(page.getByRole("heading", { level: 1, name: "Community transparency report" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^\d{4}-Q[1-4]$/ }).first()).toBeVisible();
  await expect(page.getByText(/Small numbers are shown as “fewer than 5”/)).toBeVisible();
  await page.goto("/en/community/guidelines");
  await page.getByRole("link", { name: /our transparency report/ }).click();
  await expect(page).toHaveURL(/\/en\/transparency/);
});

test("an author appeals a removed post and the community lead reverses the decision", async ({ page, browser }) => {
  const text = `Apricot kernels cure cancer, my aunt proved it (${unique()})`;
  await join(page, `Hopeful Ash ${unique()}`);
  await postText(page, text);
  await expect(page.getByText("Your post is waiting for review")).toBeVisible();

  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await admin.addInitScript(() => localStorage.setItem("stepwell.welcome.v1", "true"));
  await admin.goto("/en/admin");
  const queued = admin.locator("li", { hasText: text }).first();
  await queued.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(admin.locator("li", { hasText: text })).toHaveCount(0);

  await page.reload();
  const mine = page.locator("section", { has: page.getByRole("heading", { name: "Your held and removed posts" }) });
  const item = mine.locator("li", { hasText: text });
  await expect(item.getByText("Removed by a moderator")).toBeVisible();
  await item.getByRole("button", { name: "Ask for a review" }).click();
  await item.getByLabel("Ask for the decision to be looked at again").fill("It was a question about what I read, not advice.");
  await item.getByRole("button", { name: "Send my request" }).click();
  await expect(page.getByText("Thank you. The community lead will look at it")).toBeVisible();
  await expect(item.getByText("Review requested")).toBeVisible();

  await admin.reload();
  const appeal = admin.locator("li", { hasText: "It was a question about what I read" });
  await appeal.getByPlaceholder("Reply to the member").fill("You're right — it's back, with a note about the evidence.");
  await appeal.getByRole("button", { name: "Reverse the decision" }).click();
  await expect(admin.getByText("No appeals are waiting.")).toBeVisible();

  await page.reload();
  await expect(page.locator("article", { hasText: text })).toBeVisible();
  await ctx.close();
});

test("a clinical reviewer signs off an insight and readers see it", async ({ page }, info) => {
  // one insight per project: both projects share the same backend
  const id = info.project.name === "phone" ? "physical-activity-prevention.en" : "alcohol-risk.en";
  await page.goto("/en/admin");
  await page.getByRole("button", { name: "Published, not signed off" }).click();
  await page.getByLabel("Reviewer (name and role)").fill("Dr A. Example, oncologist");
  const item = page.locator("li", { hasText: id });
  await expect(page.locator("li", { hasText: "quitting-smoking.en" }).first()).toBeVisible(); // list loaded
  if (await item.count()) await item.getByRole("button", { name: "Sign off" }).click(); // (already done on a retry)
  await expect(page.locator("li", { hasText: id })).toHaveCount(0);
  await page.goto(`/en/insights/${id}`);
  await expect(page.getByText(/Reviewed by our clinical team/)).toBeVisible();
});
