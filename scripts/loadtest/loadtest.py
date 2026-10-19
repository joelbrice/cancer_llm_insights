"""Load test for Stepwell: a realistic mix of page views, insight reads, evidence search, streamed answers and
community reads, run by concurrent virtual users. Uses only httpx (already a backend dependency).

    python scripts/loadtest/loadtest.py --base http://localhost:3000 --users 50 --duration 60
    python scripts/loadtest/loadtest.py --base https://staging.stepwell.example --users 200 --duration 300 \
        --report docs/loadtest-staging.md

Point it at staging, never at production. The API's rate limits apply per client address, so a run from one
machine needs them raised (RATE_LIMIT_PER_MINUTE, CHAT_RATE_LIMIT_PER_MINUTE) or the 429s are counted as errors.

Targets checked (BUILD_SPEC §12, p95): pages < 1000 ms to first byte, insight API < 300 ms, first answer token
< 800 ms in extractive mode (2500 ms with a GPU model: --llm). Exit code 1 when a target or the 1 % error budget
is missed.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import statistics
import sys
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field

import httpx

LANGS = ["en", "fr", "de", "ar", "es", "pt", "it"]
# Weighted the way people use the app: mostly reading, some asking, a little community.
MIX = [("page_home", 14), ("page_insights", 10), ("page_insight", 16), ("page_library", 4), ("api_insights", 14),
       ("api_insight", 14), ("api_search", 8), ("chat_first_token", 8), ("community_feed", 8), ("api_transparency", 4)]
QUESTIONS = {
    "en": "Does regular physical activity lower the risk of colon cancer?",
    "fr": "L'activité physique régulière réduit-elle le risque de cancer du côlon ?",
    "de": "Senkt regelmäßige Bewegung das Risiko für Darmkrebs?",
    "ar": "هل يقلل النشاط البدني المنتظم من خطر الإصابة بسرطان القولون؟",
    "es": "¿La actividad física regular reduce el riesgo de cáncer de colon?",
    "pt": "A atividade física regular reduz o risco de câncer de cólon?",
    "it": "L'attività fisica regolare riduce il rischio di tumore del colon?",
}
TARGETS_MS = {"page": 1000.0, "api_insight": 300.0, "api_insights": 300.0, "chat_first_token": 800.0}


@dataclass
class Stats:
    latencies: dict[str, list[float]] = field(default_factory=lambda: defaultdict(list))
    errors: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    statuses: dict[str, dict[int, int]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(int)))

    def ok(self, name: str, ms: float) -> None:
        self.latencies[name].append(ms)

    def fail(self, name: str, status: int) -> None:
        self.errors[name] += 1
        self.statuses[name][status] += 1


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, round(p / 100 * len(ordered) + 0.5) - 1))]


class User:
    def __init__(self, client: httpx.AsyncClient, stats: Stats, insight_ids: dict[str, list[str]],
                 member_token: str | None) -> None:
        self.c, self.stats, self.ids, self.token = client, stats, insight_ids, member_token
        self.lang = random.choice(LANGS)

    async def _get(self, name: str, url: str, **kw) -> None:
        start = time.perf_counter()
        try:
            async with self.c.stream("GET", url, **kw) as r:  # time to first byte: headers received
                ms = (time.perf_counter() - start) * 1000
                await r.aread()
            (self.stats.ok(name, ms) if r.status_code < 400 else self.stats.fail(name, r.status_code))
        except httpx.HTTPError:
            self.stats.fail(name, 0)

    def _insight(self) -> str | None:
        ids = self.ids.get(self.lang) or self.ids.get("en") or []
        return random.choice(ids) if ids else None

    async def step(self, action: str) -> None:
        lang = self.lang
        if action == "page_home":
            await self._get(action, f"/{lang}")
        elif action == "page_insights":
            await self._get(action, f"/{lang}/insights")
        elif action == "page_insight":
            if (i := self._insight()):
                await self._get(action, f"/{lang}/insights/{i}")
        elif action == "page_library":
            await self._get(action, f"/{lang}/library")
        elif action == "api_insights":
            await self._get(action, "/api/v1/insights", params={"lang": lang})
        elif action == "api_insight":
            if (i := self._insight()):
                await self._get(action, f"/api/v1/insights/{i}", params={"lang": lang})
        elif action == "api_transparency":
            await self._get(action, "/api/v1/transparency")
        elif action == "community_feed":
            if self.token:
                await self._get(action, "/api/v1/community/posts", headers={"X-Member-Token": self.token})
        elif action == "api_search":
            start = time.perf_counter()
            try:
                r = await self.c.post("/api/v1/search", json={"query": QUESTIONS[lang], "language": lang})
                ms = (time.perf_counter() - start) * 1000
                (self.stats.ok(action, ms) if r.status_code < 400 else self.stats.fail(action, r.status_code))
            except httpx.HTTPError:
                self.stats.fail(action, 0)
        elif action == "chat_first_token":
            await self.chat(lang)

    async def chat(self, lang: str) -> None:
        body = {"messages": [{"role": "user", "content": QUESTIONS[lang]}], "language": lang, "stream": True}
        start = time.perf_counter()
        first = None
        try:
            async with self.c.stream("POST", "/api/v1/chat", json=body) as r:
                if r.status_code >= 400:
                    self.stats.fail("chat_first_token", r.status_code)
                    return
                async for line in r.aiter_lines():
                    if first is None and line.startswith("event: delta"):
                        first = (time.perf_counter() - start) * 1000
                    if line.startswith("event: error"):
                        self.stats.fail("chat_first_token", 200)
                        return
            total = (time.perf_counter() - start) * 1000
            if first is None:  # abstained or safety answer: no deltas; count the whole answer
                first = total
            self.stats.ok("chat_first_token", first)
            self.stats.ok("chat_complete", total)
        except httpx.HTTPError:
            self.stats.fail("chat_first_token", 0)


async def discover(client: httpx.AsyncClient) -> dict[str, list[str]]:
    ids: dict[str, list[str]] = {}
    for lang in LANGS:
        r = await client.get("/api/v1/insights", params={"lang": lang})
        if r.status_code == 200:
            data = r.json()
            items = data.get("items", data) if isinstance(data, dict) else data
            ids[lang] = [i["id"] for i in items if isinstance(i, dict) and "id" in i][:50]
    return ids


async def join_community(client: httpx.AsyncClient) -> str | None:
    r = await client.post("/api/v1/community/members", json={
        "handle": f"load{uuid.uuid4().hex[:8]}", "language": "en", "accept_guidelines": True, "confirm_age": True,
        "consent_health_data": True})
    return r.json().get("token") if r.status_code == 201 else None


async def run(args: argparse.Namespace) -> int:
    limits = httpx.Limits(max_connections=args.users * 2, max_keepalive_connections=args.users)
    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(base_url=args.base.rstrip("/"), limits=limits, timeout=timeout,
                                 headers={"User-Agent": "stepwell-loadtest"}) as client:
        ids = await discover(client)
        token = await join_community(client)
        print(f"insights per language: { {k: len(v) for k, v in ids.items()} }; community member: {bool(token)}",
              file=sys.stderr)
        stats = Stats()
        names, weights = zip(*MIX, strict=True)
        deadline = time.perf_counter() + args.duration
        started = time.perf_counter()

        async def virtual_user(n: int) -> None:
            await asyncio.sleep(random.random() * args.ramp)  # ramp up
            user = User(client, stats, ids, token)
            while time.perf_counter() < deadline:
                await user.step(random.choices(names, weights)[0])
                await asyncio.sleep(random.expovariate(1 / args.think))  # think time between actions

        await asyncio.gather(*(virtual_user(n) for n in range(args.users)))
        elapsed = time.perf_counter() - started

    return report(stats, elapsed, args)


def report(stats: Stats, elapsed: float, args: argparse.Namespace) -> int:
    targets = dict(TARGETS_MS)
    if args.llm:
        targets["chat_first_token"] = 2500.0
    rows, failed = [], []
    total_ok = sum(len(v) for k, v in stats.latencies.items() if k != "chat_complete")
    total_err = sum(stats.errors.values())
    for name in sorted(set(stats.latencies) | set(stats.errors)):
        lat = stats.latencies.get(name, [])
        target = targets.get(name) or (targets["page"] if name.startswith("page_") else None)
        p95 = pct(lat, 95)
        verdict = "" if target is None else ("ok" if p95 <= target else "MISSED")
        if verdict == "MISSED":
            failed.append(f"{name} p95 {p95:.0f} ms > {target:.0f} ms")
        errs = stats.errors.get(name, 0)
        codes = ", ".join(f"{k}×{v}" for k, v in sorted(stats.statuses.get(name, {}).items()))
        rows.append(f"| {name} | {len(lat)} | {errs}{f' ({codes})' if codes else ''} | {pct(lat, 50):.0f} | "
                    f"{p95:.0f} | {pct(lat, 99):.0f} | {max(lat) if lat else float('nan'):.0f} | "
                    f"{'' if target is None else f'{target:.0f}'} {verdict} |")
    error_rate = total_err / max(1, total_ok + total_err)
    if error_rate > 0.01:
        failed.append(f"error rate {error_rate:.2%} > 1%")
    lines = [
        f"Load test: {args.users} virtual users for {elapsed:.0f} s against {args.base} "
        f"(think time {args.think:.1f} s).",
        "",
        f"Requests: {total_ok + total_err} ({(total_ok + total_err) / elapsed:.1f}/s), errors {total_err} "
        f"({error_rate:.2%}).",
        "",
        "| Step | OK | Errors | p50 ms | p95 ms | p99 ms | max ms | Target p95 ms |",
        "|---|---:|---:|---:|---:|---:|---:|---|",
        *rows,
        "",
        "Pages and API reads: time to first byte. `chat_first_token`: time to the first streamed answer text; "
        "`chat_complete`: the whole streamed answer.",
    ]
    text = "\n".join(lines)
    print(text)
    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    if failed:
        print("\nMISSED: " + "; ".join(failed), file=sys.stderr)
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", default="http://localhost:3000", help="site URL (web, with /api routed to the API)")
    parser.add_argument("--users", type=int, default=50)
    parser.add_argument("--duration", type=float, default=60.0, help="seconds")
    parser.add_argument("--ramp", type=float, default=10.0, help="seconds to start all users")
    parser.add_argument("--think", type=float, default=1.0, help="mean seconds between a user's actions")
    parser.add_argument("--llm", action="store_true", help="a GPU model answers (first-token target 2.5 s)")
    parser.add_argument("--report", help="also write the Markdown table to this file")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    random.seed(args.seed)
    print(json.dumps({"base": args.base, "users": args.users, "duration": args.duration}), file=sys.stderr)
    return asyncio.run(run(args))


if __name__ == "__main__":
    sys.exit(main())
