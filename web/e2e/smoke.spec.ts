import { expect, LOCALES, noHorizontalOverflow, PAGES, test } from "./fixtures";

for (const lang of LOCALES) {
  test(`every page renders in ${lang} without errors or overflow`, async ({ page, errors }) => {
    for (const path of PAGES) {
      const res = await page.goto(`/${lang}${path}`, { waitUntil: "networkidle" });
      expect(res?.status(), `${lang}${path}`).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
      expect(await noHorizontalOverflow(page), `overflow on ${lang}${path}`).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test.describe("first launch", () => {
  test.use({ firstVisit: true });
  test("notice is shown once, then remembered", async ({ page, errors }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    const dialog = page.getByRole("dialog", { name: /Welcome to Stepwell/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("not medical advice");
    await dialog.getByRole("button", { name: "I understand" }).click();
    await expect(dialog).toBeHidden();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("dialog", { name: /Welcome to Stepwell/ })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test("locale negotiation redirects the root to a language", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/(en|fr|es|pt|de|it|ar)$/);
});

test("Italian and Arabic browsers land in their language, and Arabic reads right to left", async ({ browser }) => {
  for (const [locale, lang] of [["it-IT", "it"], ["ar-LB", "ar"]] as const) {
    const ctx = await browser.newContext({ locale });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem("stepwell.welcome.v1", "true"));
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(new RegExp(`/${lang}$`));
    const width = page.viewportSize()!.width;
    const brand = (await page.locator("header a").first().boundingBox())!;
    if (lang === "ar") expect(brand.x).toBeGreaterThan(width / 2); // the brand sits at the start: the right
    else expect(brand.x + brand.width).toBeLessThan(width / 2);
    await ctx.close();
  }
});

test("legal pages are linked from every page and stay marked as drafts until approved", async ({ page, errors }) => {
  await page.goto("/de", { waitUntil: "networkidle" });
  const footer = page.getByRole("contentinfo");
  for (const [label, heading] of [
    ["Datenschutz", "Datenschutzerklärung"],
    ["Nutzungsbedingungen", "Nutzungsbedingungen"],
    ["Impressum", "Impressum"],
    ["Barrierefreiheit", "Erklärung zur Barrierefreiheit"],
  ] as const) {
    await footer.getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Entwurf zur rechtlichen Prüfung");
  }
  // The test stack sets no operator details: they are flagged, never silently empty.
  await expect(page.getByText("[Name des Anbieters: noch zu ergänzen]").first()).toBeVisible();
  await page.goto("/ar/privacy", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "سياسة الخصوصية" })).toBeVisible();
  expect(errors).toEqual([]);
});
