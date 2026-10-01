import { BRAND, brandName, createTranslator } from "@stepwell/shared";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const t = createTranslator("en");
  return {
    id: "/",
    name: `${brandName()} — ${t("app.descriptor")}`,
    short_name: BRAND.shortName,
    description: t("app.description"),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: BRAND.backgroundColor,
    theme_color: BRAND.themeColor,
    categories: ["health", "medical", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: t("nav.ask"), url: "/ask", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t("nav.insights"), url: "/insights", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t("nav.community"), url: "/community", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t("nav.plan"), url: "/plan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
