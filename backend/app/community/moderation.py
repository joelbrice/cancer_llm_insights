"""Automated screening of community posts and handles.

Screening never silently edits what people write. Each post is either published, published with a reader note
("treatment decisions belong with your care team"), held for a human moderator, or rejected with a reason the
author can act on (e.g. remove a phone number). People in crisis are never just blocked: the author immediately
receives crisis or urgent-care guidance, and the post goes to the top of the moderation queue.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import yaml

from app.core.text import fold_accents
from app.safety.guardrails import Guardrails, SafetyAssessment

RESOURCES = Path(__file__).resolve().parent.parent / "resources"

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_URL = re.compile(r"\b(?:https?://|www\.)[^\s<>()]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|info|biz|shop|"
                  r"fr|es|pt|de|uk|br|be|ch|at|ly|me|app|link)(?:/[^\s<>()]*)?\b", re.IGNORECASE)
_PHONE = re.compile(r"(?<![\w.,])\+?\d[\d\s().-]{6,}\d(?![\w])")
_YEAR_RANGE = re.compile(r"(?:19|20)\d{2}\s*[-–/]\s*(?:19|20)\d{2}")
_DATE = re.compile(r"\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4}")
_HANDLE = re.compile(r"^[\w][\w .'-]{1,22}[\w.]$", re.UNICODE)

# Guardrail rules (resources/safety.yaml) and what they mean for a community post.
_HOLD_WITH_GUIDANCE = {"self_harm": "crisis", "medical_emergency": "emergency", "oncologic_urgent": "urgent"}
_HOLD = {"harmful_alternative": "medical_claim"}
_CARE_TEAM_NOTE = {"treatment_decision", "diagnosis_request", "supplement_interaction"}


@dataclass(slots=True)
class Screening:
    action: Literal["publish", "hold", "reject"]
    reason: str | None = None
    flags: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    safety: SafetyAssessment | None = None
    priority: int = 0  # queue ordering: 2 crisis/emergency, 1 urgent, 0 other


class CommunityConfig:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or RESOURCES / "community.yaml"

    @cached_property
    def raw(self) -> dict:
        return yaml.safe_load(self.path.read_text(encoding="utf-8"))

    @property
    def guidelines_version(self) -> int:
        return int(self.raw.get("guidelines_version", 1))

    @cached_property
    def circles(self) -> dict[str, dict]:
        return {c["id"]: c for c in self.raw["circles"]}

    @property
    def kinds(self) -> list[str]:
        return list(self.raw["kinds"])

    @property
    def reactions(self) -> list[str]:
        return list(self.raw["reactions"])

    @property
    def report_reasons(self) -> list[str]:
        return list(self.raw["report_reasons"])

    def localized(self, circle: dict, key: str, lang: str):
        table = circle[key]
        return table.get(lang) or table["en"]

    def prompt(self, circle_id: str, lang: str, week: int) -> str:
        prompts = self.localized(self.circles[circle_id], "prompts", lang)
        return prompts[week % len(prompts)]

    @cached_property
    def _moderation(self) -> dict:
        return self.raw.get("moderation", {})

    @cached_property
    def allowed_domains(self) -> set[str]:
        return {d.lower() for d in self._moderation.get("allowed_link_domains", [])}

    @cached_property
    def solicitation(self) -> list[re.Pattern[str]]:
        return [re.compile(p, re.IGNORECASE) for p in self._moderation.get("solicitation", [])]

    @cached_property
    def abuse(self) -> list[re.Pattern[str]]:
        return [re.compile(p, re.IGNORECASE) for p in self._moderation.get("abuse", [])]

    @cached_property
    def reserved_handles(self) -> re.Pattern[str]:
        return re.compile(self._moderation.get("reserved_handles", r"(?!x)x"), re.IGNORECASE)


class CommunityModerator:
    def __init__(self, config: CommunityConfig, guardrails: Guardrails) -> None:
        self.config = config
        self.guardrails = guardrails

    # ── personal data & links ───────────────────────────────────────────────────
    def _allowed_link(self, url: str) -> bool:
        host = urlparse(url if "://" in url else f"https://{url}").hostname or ""
        host = host.lower().removeprefix("www.")
        return any(host == d or host.endswith("." + d) for d in self.config.allowed_domains)

    @staticmethod
    def _has_phone(text: str) -> bool:
        for match in _PHONE.finditer(text):
            candidate = match.group(0).strip()
            if _YEAR_RANGE.fullmatch(candidate) or _DATE.fullmatch(candidate):
                continue
            if sum(ch.isdigit() for ch in candidate) >= 8:
                return True
        return False

    def contact_details(self, text: str) -> str | None:
        if _EMAIL.search(text) or self._has_phone(text):
            return "contact_details"
        for match in _URL.finditer(text):
            if not self._allowed_link(match.group(0)):
                return "links"
        return None

    # ── posts ─────────────────────────────────────────────────────────────────────
    def screen(self, text: str, lang: str, country: str | None = None) -> Screening:
        reason = self.contact_details(text)
        if reason:
            return Screening("reject", reason=reason, flags=[reason])

        result = Screening("publish")
        assessment = self.guardrails.check_input(text, lang, country)
        for rule in assessment.flags:
            if rule in _HOLD_WITH_GUIDANCE:
                result.action = "hold"
                result.reason = result.reason or _HOLD_WITH_GUIDANCE[rule]
                result.flags.append(rule)
                result.safety = assessment
                result.priority = max(result.priority, 1 if rule == "oncologic_urgent" else 2)
            elif rule in _HOLD:
                result.action = "hold"
                result.reason = result.reason or _HOLD[rule]
                result.flags.append(rule)
            elif rule in _CARE_TEAM_NOTE:
                result.flags.append(rule)
                if "care_team" not in result.notes:
                    result.notes.append("care_team")

        for rule in self.guardrails.check_output(text):  # "X cures cancer", "you can stop your chemo"
            result.action = "hold"
            result.reason = result.reason or "medical_claim"
            result.flags.append(rule)

        folded = fold_accents(text)
        if any(p.search(text) or p.search(folded) for p in self.config.solicitation):
            result.action, result.reason = "hold", result.reason or "solicitation"
            result.flags.append("solicitation")
        if any(p.search(text) or p.search(folded) for p in self.config.abuse):
            result.action, result.reason = "hold", result.reason or "abuse"
            result.flags.append("abuse")
        return result

    # ── handles ───────────────────────────────────────────────────────────────────
    def check_handle(self, handle: str) -> str | None:
        """Returns an error code, or None when the handle is acceptable."""
        if not _HANDLE.match(handle) or not any(ch.isalpha() for ch in handle):
            return "handle_format"
        if self.contact_details(handle):
            return "handle_contact"
        folded = fold_accents(handle)
        if self.config.reserved_handles.search(handle) or self.config.reserved_handles.search(folded):
            return "handle_reserved"
        if any(p.search(handle) or p.search(folded) for p in self.config.abuse):
            return "handle_abuse"
        return None


def handle_key(handle: str) -> str:
    return re.sub(r"[\s._'-]+", "", fold_accents(handle).lower())
