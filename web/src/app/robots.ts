import type { MetadataRoute } from "next";

// Read NOINDEX when the request arrives, so one image serves both staging (not indexed) and production.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (process.env.NOINDEX === "true") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/*/admin", "/*/profile", "/*/plan", "/*/community"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
