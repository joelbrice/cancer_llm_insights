import { test as base, expect, type Page } from "@playwright/test";

/** Every test starts as a returning visitor (first-launch notice acknowledged) unless it opts out. */
export const test = base.extend<{ firstVisit: boolean; errors: string[] }>({
  firstVisit: [false, { option: true }],
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
    });
    await use(errors);
  },
  page: async ({ page, firstVisit }, use) => {
    if (!firstVisit) await page.addInitScript(() => localStorage.setItem("stepwell.welcome.v1", "true"));
    await use(page);
  },
});

export { expect };
export type { Page };

export async function noHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

export const LOCALES = ["en", "fr", "es", "pt", "de"] as const;
export const PAGES = [
  "", "/ask", "/insights", "/community", "/community/guidelines", "/check", "/plan", "/library", "/methodology", "/profile",
  "/about", "/admin", "/appointment", "/transparency",
];
