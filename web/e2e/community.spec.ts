import { expect, test, type Page } from "./fixtures";

async function join(page: Page, handle: string) {
  await page.goto("/en/community", { waitUntil: "networkidle" });
  const nickname = page.getByLabel("Nickname");
  await expect(async () => {
    await nickname.fill(handle);
    await expect(nickname).toHaveValue(handle, { timeout: 1000 });
  }).toPass();
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await expect(page.getByRole("button", { name: "Join", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByPlaceholder(/Share a small win/)).toBeVisible();
}

const unique = () => Math.random().toString(36).slice(2, 7);

test("join, post, get rejected for contact details, then encouraged by another member", async ({ page, browser, errors }) => {
  const me = `Calm Oak ${unique()}`;
  const text = `First walk around the park since treatment ended! (${unique()})`;
  await join(page, me);
  await page.getByPlaceholder(/Share a small win/).fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText(text)).toBeVisible();

  await page.getByPlaceholder(/Share a small win/).fill("Call me on +44 7700 900123");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "remove phone numbers" })).toBeVisible();

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await other.addInitScript(() => localStorage.setItem("stepwell.welcome.v1", "true"));
  await join(other, `Kind Fern ${unique()}`);
  const card = other.locator("article", { hasText: text });
  await card.getByRole("button", { name: /You've got this/ }).click();
  await expect(card.getByRole("button", { name: /You've got this \(1\)/ })).toBeVisible();

  // block: the post disappears for the blocker only
  other.on("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Block this member" }).click();
  await expect(other.locator("article", { hasText: text })).toHaveCount(0);
  await ctx.close();
  expect(errors).toEqual([]);
});

test("crisis posts are held with immediate help for the author", async ({ page }) => {
  await join(page, `Quiet Brook ${unique()}`);
  await page.getByPlaceholder(/Share a small win/).fill("I want to end my life, I can't do this anymore");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText("Your post is waiting for review")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Where to get help now" })).toBeVisible();
});
