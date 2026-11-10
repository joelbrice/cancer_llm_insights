import { api, load } from "@/lib/api";

// RFC 9116: where to report security problems. Uses the operator's contact address (LEGAL_CONTACT_EMAIL, or
// SECURITY_CONTACT to use a different one); not served until one is set.
export const dynamic = "force-dynamic";

export async function GET() {
  const legal = await load(() => api.legal());
  const contact = process.env.SECURITY_CONTACT || legal.data?.operator.email;
  if (!contact) return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain" } });
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const expires = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
  const lines = [
    `Contact: ${/^(mailto:|https:)/.test(contact) ? contact : `mailto:${contact}`}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en, de, fr",
    `Canonical: ${site}/.well-known/security.txt`,
    `Policy: ${site}/en/terms`,
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
