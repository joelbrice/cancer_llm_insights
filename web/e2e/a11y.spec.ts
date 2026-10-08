import AxeBuilder from "@axe-core/playwright";

import { expect, LOCALES, PAGES, test } from "./fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const lang of LOCALES) {
  test(`no serious accessibility violations in ${lang} (WCAG 2.2 AA)`, async ({ page }) => {
    const found: string[] = [];
    for (const path of [...PAGES.filter((p) => p !== "/admin"), "/insights/quitting-smoking." + lang]) {
      await page.goto(`/${lang}${path}`, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      for (const v of results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")) {
        found.push(`${lang}${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(", ")}`);
      }
    }
    expect(found).toEqual([]);
  });
}
