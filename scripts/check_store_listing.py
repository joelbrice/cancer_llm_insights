"""Check the app store texts against the stores' length limits (run in CI).

App Store texts: mobile/store.config.json (EAS Metadata: `eas metadata:push`).
Google Play texts: mobile/store/google-play/<locale>/ (fastlane supply layout).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "mobile"
APPLE = {"title": 30, "subtitle": 30, "promoText": 170, "description": 4000}
PLAY = {"title.txt": 30, "short_description.txt": 80, "full_description.txt": 4000}
LOCALES = 7


def main() -> int:
    problems: list[str] = []
    info = json.loads((ROOT / "store.config.json").read_text(encoding="utf-8"))["apple"]["info"]
    if len(info) != LOCALES:
        problems.append(f"App Store: {len(info)} languages, expected {LOCALES}")
    for locale, fields in info.items():
        for key, limit in APPLE.items():
            if len(fields.get(key, "")) > limit:
                problems.append(f"App Store {locale} {key}: {len(fields[key])} > {limit} characters")
        keywords = ",".join(fields.get("keywords", []))
        if len(keywords) > 100:
            problems.append(f"App Store {locale} keywords: {len(keywords)} > 100 characters")
        for url in ("marketingUrl", "supportUrl", "privacyPolicyUrl"):
            if not str(fields.get(url, "")).startswith("https://"):
                problems.append(f"App Store {locale} {url} must be an https URL")
    play = sorted(p for p in (ROOT / "store" / "google-play").iterdir() if p.is_dir())
    if len(play) != LOCALES:
        problems.append(f"Google Play: {len(play)} languages, expected {LOCALES}")
    for folder in play:
        for name, limit in PLAY.items():
            text = (folder / name).read_text(encoding="utf-8").rstrip("\n")
            if not text or len(text) > limit:
                problems.append(f"Google Play {folder.name}/{name}: {len(text)} characters (1–{limit})")
    for p in problems:
        print(p)
    print("store listing: ok" if not problems else f"store listing: {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
