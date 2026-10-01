import { LOCALES } from "@stepwell/shared";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pages = ["", "/ask", "/insights", "/library", "/check", "/methodology", "/about"];
  return LOCALES.flatMap((lang) =>
    pages.map((page) => ({
      url: `${site}/${lang}${page}`,
      changeFrequency: page === "/insights" ? ("daily" as const) : ("weekly" as const),
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${site}/${l}${page}`])) },
    })),
  );
}
