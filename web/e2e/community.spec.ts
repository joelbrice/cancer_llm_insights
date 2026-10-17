import { expect, test } from "./fixtures";
import { join, postText, unique } from "./helpers";

test("join, post, get rejected for contact details, then encouraged by another member", async ({ page, browser, errors }) => {
  const me = `Calm Oak ${unique()}`;
  const text = `First walk around the park since treatment ended! (${unique()})`;
  await join(page, me);
  await postText(page, text);
  await expect(page.getByText(text)).toBeVisible();

  await postText(page, "Call me on +44 7700 900123");
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
  await postText(page, "I want to end my life, I can't do this anymore");
  await expect(page.getByText("Your post is waiting for review")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Where to get help now" })).toBeVisible();
});
