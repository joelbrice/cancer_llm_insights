import { isLocale, negotiateLocale } from "@stepwell/shared";
import { NextResponse, type NextRequest } from "next/server";

/** Locale routing: /, /ask … → /{locale}/… using the saved choice (cookie) or Accept-Language. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    const response = NextResponse.next();
    // NOINDEX=true (staging, previews): every page asks search engines not to index it.
    if (process.env.NOINDEX === "true") response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  const saved = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = isLocale(saved) ? saved : negotiateLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API calls, Next internals, metadata files and anything with a file extension.
  matcher: ["/((?!api|_next|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|icon.svg|icons|offline.html|.*\\..*).*)"],
};
