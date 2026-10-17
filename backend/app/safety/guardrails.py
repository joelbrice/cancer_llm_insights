"""Input/output safety guardrails driven by resources/safety.yaml (clinical-governance controlled)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

RESOURCES = Path(__file__).resolve().parent.parent / "resources"
LEVEL_ORDER = {"none": 0, "caution": 1, "urgent": 2, "emergency": 3}

# Hidden instructions in user text or retrieved documents ("ignore previous instructions …").
_INJECTION = re.compile(
    r"ignore (all |any )?(previous|prior|above) (instructions|rules)|disregard (the )?(system|previous)|"
    r"you are now|system prompt|<\|?(system|im_start)\|?>|### ?instruction|act as (an? )?(unfiltered|dan)",
    re.IGNORECASE,
)


class CrisisResource(BaseModel):
    name: str
    contact: str


class SafetyNotice(BaseModel):
    rule: str
    level: str
    message: str


class SafetyAssessment(BaseModel):
    level: str = "none"
    flags: list[str] = Field(default_factory=list)
    block_generation: bool = False
    notices: list[SafetyNotice] = Field(default_factory=list)
    resources: list[CrisisResource] = Field(default_factory=list)
    prompt_injection: bool = False


@dataclass(slots=True)
class _Rule:
    id: str
    level: str
    block: bool
    patterns: list[re.Pattern[str]] = field(default_factory=list)


class Guardrails:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or RESOURCES / "safety.yaml"

    @cached_property
    def _config(self) -> dict:
        return yaml.safe_load(self.path.read_text(encoding="utf-8"))

    @cached_property
    def rules(self) -> list[_Rule]:
        return [
            _Rule(r["id"], r["level"], bool(r.get("block_generation")),
                  [re.compile(p, re.IGNORECASE) for p in r["patterns"]])
            for r in self._config["rules"]
        ]

    @cached_property
    def output_rules(self) -> list[tuple[str, list[re.Pattern[str]]]]:
        return [(r["id"], [re.compile(p, re.IGNORECASE) for p in r["patterns"]])
                for r in self._config.get("output_rules", [])]

    def message(self, rule_id: str, lang: str) -> str:
        table = self._config["messages"].get(rule_id, {})
        return table.get(lang) or table.get("en", "")

    def resources_for(self, country: str | None) -> list[CrisisResource]:
        table = self._config.get("crisis_resources", {})
        entries = list(table.get((country or "").upper(), [])) + list(table.get("default", []))
        return [CrisisResource(**e) for e in entries]

    def check_input(self, text: str, lang: str, country: str | None = None) -> SafetyAssessment:
        assessment = SafetyAssessment()
        for rule in self.rules:
            if any(p.search(text) for p in rule.patterns):
                assessment.flags.append(rule.id)
                assessment.notices.append(SafetyNotice(rule=rule.id, level=rule.level,
                                                       message=self.message(rule.id, lang)))
                if LEVEL_ORDER[rule.level] > LEVEL_ORDER[assessment.level]:
                    assessment.level = rule.level
                assessment.block_generation |= rule.block
        if "self_harm" in assessment.flags or "medical_emergency" in assessment.flags:
            assessment.resources = self.resources_for(country)
        if _INJECTION.search(text):
            assessment.prompt_injection = True
            assessment.flags.append("prompt_injection")
        assessment.notices.sort(key=lambda n: -LEVEL_ORDER[n.level])
        return assessment

    def check_output(self, text: str) -> list[str]:
        return [rule_id for rule_id, patterns in self.output_rules if any(p.search(text) for p in patterns)]

    @staticmethod
    def sanitize_evidence(text: str) -> str:
        """Neutralise instruction-like content inside retrieved documents (indirect prompt injection)."""
        return _INJECTION.sub("[removed]", text).replace("</evidence>", "").replace("<evidence>", "")
