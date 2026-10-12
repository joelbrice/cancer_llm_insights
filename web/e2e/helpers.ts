import { expect, type Page } from "./fixtures";

export async function join(page: Page, handle: string) {
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

export const unique = () => Math.random().toString(36).slice(2, 7);

/** Fill the composer and post. Retries the fill until React has it (the composer resets after each post). */
export async function postText(page: Page, text: string) {
  const box = page.getByPlaceholder(/Share a small win/);
  const button = page.getByRole("button", { name: "Post", exact: true });
  await expect(async () => {
    await box.fill(text);
    await expect(button).toBeEnabled({ timeout: 1000 });
  }).toPass();
  await button.click();
}
