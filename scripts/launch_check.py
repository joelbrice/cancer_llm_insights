"""Launch readiness check for a running Stepwell deployment. Read-only: it only sends GET requests.

    python3 scripts/launch_check.py https://app.stepwell.example
    python3 scripts/launch_check.py https://staging.stepwell.example --staging

Checks the things software can verify (TLS and security headers, production settings, admin protection, library and
insights, legal details and approval, legal pages in every language, search-engine settings). It cannot check the
manual launch items in docs/LAUNCH.md (clinical sign-off, DPIA, contracts, audits); those stay on that list.
Exit code 1 when any check fails.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

LANGS = ["en", "fr", "es", "pt", "de", "it", "ar"]
LEGAL = ["privacy", "terms", "imprint", "accessibility"]


class Check:
    def __init__(self) -> None:
        self.results: list[tuple[str, str, str]] = []

    def add(self, status: str, name: str, detail: str = "") -> None:
        self.results.append((status, name, detail))

    def ok(self, cond: bool, name: str, detail: str = "", warn: bool = False) -> None:
        self.add("ok" if cond else ("warn" if warn else "FAIL"), name, "" if cond else detail)


def get(url: str, timeout: float = 20) -> tuple[int, dict[str, str], bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": "stepwell-launch-check"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 (operator-supplied URL)
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read()


def run(site: str, staging: bool) -> Check:
    c = Check()
    site = site.rstrip("/")
    c.ok(site.startswith("https://"), "served over HTTPS", f"{site} is not https")

    status, headers, _ = get(f"{site}/en")
    c.ok(status == 200, "home page loads", f"HTTP {status}")
    c.ok("strict-transport-security" in headers, "HSTS header on pages", "missing Strict-Transport-Security")
    c.ok("content-security-policy" in headers, "Content-Security-Policy on pages", "missing")
    noindex = "noindex" in headers.get("x-robots-tag", "")
    if staging:
        c.ok(noindex, "staging is not indexed by search engines", "set NOINDEX=true on the web deployment")
    else:
        c.ok(not noindex, "production pages can be indexed", "NOINDEX is set on production")

    status, _, body = get(f"{site}/api/v1/status")
    c.ok(status == 200, "API reachable at /api/v1", f"HTTP {status}")
    st = json.loads(body or b"{}") if status == 200 else {}
    want_env = "staging" if staging else "production"
    c.ok(st.get("environment") == want_env, f"ENVIRONMENT={want_env}", f"API reports {st.get('environment')!r}")
    c.ok(st.get("admin_protected") is True, "admin API protected by a key", "ADMIN_API_KEY is not set")
    c.ok(st.get("data_status") == "ready", "evidence library linked and indexed", f"data_status={st.get('data_status')!r}")
    c.ok((st.get("documents") or 0) >= 100, "library has at least 100 documents",
         f"{st.get('documents')} documents (BUILD_SPEC §16: enough research for 80 % of topics)", warn=True)
    c.ok((st.get("insights") or 0) > 0, "insights published", "no insights yet")
    c.ok(set(st.get("languages") or []) >= set(LANGS), "all seven languages enabled", f"{st.get('languages')}")
    llm = st.get("llm") or {}
    c.ok(llm.get("available") is not False, "answer model reachable", f"{llm.get('provider')}: not available")
    c.ok(llm.get("provider") != "extractive", "fine-tuned model in use",
         "LLM_PROVIDER=extractive (works, but answers are extractive summaries)", warn=True)
    emb = st.get("embeddings") or {}
    c.ok(emb.get("multilingual") is True, "multilingual embeddings", f"{emb.get('provider')}: not multilingual", warn=True)
    c.ok((st.get("vector_store") or {}).get("healthy") is True, "vector store healthy", "unhealthy")

    status, _, _ = get(f"{site}/api/v1/admin/sources")
    c.ok(status in (401, 403), "admin API refuses requests without a key", f"HTTP {status}")

    status, _, body = get(f"{site}/api/v1/legal")
    legal = json.loads(body or b"{}") if status == 200 else {}
    missing = legal.get("missing", ["(endpoint unavailable)"])
    c.ok(not missing, "operator details for the legal pages", "missing: " + ", ".join(missing))
    c.ok(bool(legal.get("effective_date")), "legal texts carry a version date", "LEGAL_EFFECTIVE_DATE not set")
    c.ok(legal.get("approved") is True, "legal texts approved by counsel", "LEGAL_APPROVED is not true")

    broken = [f"/{lang}/{page}" for lang in LANGS for page in LEGAL if get(f"{site}/{lang}/{page}")[0] != 200]
    c.ok(not broken, "legal pages in every language", "failing: " + ", ".join(broken))

    status, _, body = get(f"{site}/robots.txt")
    disallow_all = b"Disallow: /\n" in body + b"\n"
    c.ok(status == 200, "robots.txt served", f"HTTP {status}")
    if not staging:
        c.ok(not disallow_all, "robots.txt allows indexing", "robots.txt disallows everything")
    status, _, _ = get(f"{site}/.well-known/security.txt")
    c.ok(status == 200, "security.txt published", "set LEGAL_CONTACT_EMAIL or SECURITY_CONTACT", warn=True)
    return c


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("site", help="site URL, e.g. https://app.stepwell.example")
    parser.add_argument("--staging", action="store_true", help="expect a staging deployment")
    args = parser.parse_args()
    c = run(args.site, args.staging)
    width = max(len(n) for _, n, _ in c.results)
    for status, name, detail in c.results:
        print(f"{status:>4}  {name:<{width}}  {detail}")
    failed = sum(1 for s, _, _ in c.results if s == "FAIL")
    warned = sum(1 for s, _, _ in c.results if s == "warn")
    print(f"\n{len(c.results) - failed - warned} ok, {warned} warnings, {failed} failed."
          " Manual launch items: docs/LAUNCH.md")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
