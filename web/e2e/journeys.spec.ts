import { expect, test } from "./fixtures";

test("ask: streamed, cited answer with a quoted source", async ({ page, errors }) => {
  await page.goto("/en/ask", { waitUntil: "networkidle" });
  await expect(page.getByText("Answers are written by AI")).toBeVisible(); // EU AI Act Art. 50(1)
  await page.locator("#ask-input").fill("Does physical activity lower the risk of colon cancer?");
  await page.keyboard.press("Enter");
  const cite = page.getByRole("button", { name: /^Sources 1:/ }).first();
  await expect(cite).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/statements verified/)).toBeVisible();
  await cite.click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("“");
  expect(errors).toEqual([]);
});

test("ask: emergencies get safety guidance first", async ({ page }) => {
  await page.goto("/en/ask", { waitUntil: "networkidle" });
  await page.locator("#ask-input").fill("I have crushing chest pain and can't breathe");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "This may be an emergency" })).toBeVisible({ timeout: 20_000 });
});

test("insight → add to my plan → weekly check-in", async ({ page, errors }) => {
  await page.goto("/en/insights", { waitUntil: "networkidle" });
  const withRecommendation = page.locator("a[href*='quitting-smoking.en']").first();
  await withRecommendation.click();
  await page.getByRole("button", { name: "Add to my plan" }).first().click();
  await expect(page.getByRole("button", { name: "In my plan" }).first()).toBeVisible();
  await page.goto("/en/plan", { waitUntil: "networkidle" });
  const box = page.getByRole("checkbox").first();
  await box.check();
  await expect(page.getByText("1-week streak")).toBeVisible();
  expect(errors).toEqual([]);
});

test("lifestyle check: 15 answers → results that are not a risk score", async ({ page, errors }) => {
  await page.goto("/en/check", { waitUntil: "networkidle" });
  for (let i = 0; i < 15; i++) {
    await page.getByRole("radio").first().check();
    const next = page.getByRole("button", { name: /Next|See my results/ });
    await next.click();
  }
  await expect(page.getByRole("heading", { name: "Your results" })).toBeVisible();
  await expect(page.getByText("This is not a cancer risk score").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("library → document → cited by", async ({ page }) => {
  await page.goto("/en/library", { waitUntil: "networkidle" });
  await page.locator("a[href*='/en/library/']").first().click();
  await expect(page.getByText("Indexed passages")).toBeVisible();
});
