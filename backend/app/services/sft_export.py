"""Supervised fine-tuning dataset export for LLaMA (RAFT-style retrieval-augmented fine-tuning).

Each example reproduces the exact production prompt (system + numbered <evidence> + question) so the model
learns the *behaviour* — cite every claim, abstain without evidence, respect clinical boundaries, answer in the
user's language — while knowledge keeps coming from retrieval. Examples mix:
  * grounded answers (oracle passages shuffled with distractor passages from other topics)
  * abstentions (only distractors provided → the model must say evidence is insufficient)
  * safety behaviours (emergency / crisis / boundaries) in every supported language
Targets come from verified, published insights; human clinical review of a sample is required before training.
"""

from __future__ import annotations

import json
import logging
import random
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from app.i18n import t
from app.llm.extractive import ExtractiveComposer
from app.llm.prompts import PROMPT_VERSION, SYSTEM_CHAT, USER_CHAT, format_evidence, language_name
from app.retrieval.retriever import HybridRetriever
from app.safety.guardrails import Guardrails
from app.schemas.evidence import EvidenceChunk
from app.services.insights import InsightService
from app.settings import Settings

log = logging.getLogger(__name__)

SAFETY_SEEDS: dict[str, dict[str, list[str]]] = {
    "medical_emergency": {
        "en": ["I have crushing chest pain and I'm sweating, what natural remedy can help?"],
        "fr": ["J'ai une douleur thoracique intense et je n'arrive pas à respirer, que faire ?"],
        "es": ["Tengo un dolor fuerte en el pecho y no puedo respirar, ¿qué hago?"],
        "pt": ["Tenho uma dor forte no peito e não consigo respirar, o que faço?"],
        "de": ["Ich habe starke Brustschmerzen und kann nicht atmen, was soll ich tun?"],
    },
    "oncologic_urgent": {
        "en": ["I'm on chemo and I have a fever of 38.5 tonight, can I just take paracetamol and sleep?"],
        "fr": ["Je suis sous chimio et j'ai 38,5 de fièvre ce soir, je peux juste prendre du paracétamol ?"],
        "es": ["Estoy con quimio y tengo fiebre de 38,5 esta noche, ¿puedo tomar paracetamol y dormir?"],
        "pt": ["Estou a fazer quimio e tenho febre de 38,5 esta noite, posso só tomar paracetamol?"],
        "de": ["Ich bekomme Chemo und habe heute Abend 38,5 Fieber, reicht Paracetamol?"],
    },
    "treatment_decision": {
        "en": ["Should I stop my chemotherapy and try a strict vegan diet instead?"],
        "fr": ["Dois-je arrêter ma chimiothérapie et suivre un régime végétalien strict à la place ?"],
        "es": ["¿Debería dejar la quimioterapia y seguir una dieta vegana estricta en su lugar?"],
        "pt": ["Devo parar a quimioterapia e fazer uma dieta vegana rigorosa em vez disso?"],
        "de": ["Soll ich die Chemotherapie abbrechen und stattdessen streng vegan essen?"],
    },
}


class SFTExporter:
    def __init__(self, settings: Settings, retriever: HybridRetriever, insights: InsightService,
                 composer: ExtractiveComposer, guardrails: Guardrails) -> None:
        self.settings = settings
        self.retriever = retriever
        self.insights = insights
        self.composer = composer
        self.guardrails = guardrails

    def _system(self, lang: str) -> str:
        return SYSTEM_CHAT.format(brand=self.settings.app_name, language_name=language_name(lang))

    def _user(self, question: str, evidence: list[EvidenceChunk], grade: str) -> str:
        return USER_CHAT.format(profile_block="", grade=grade, evidence=format_evidence(evidence), safety_block="",
                                question=question)

    @staticmethod
    def _renumber(evidence: list[EvidenceChunk]) -> list[EvidenceChunk]:
        return [e.model_copy(update={"n": i}) for i, e in enumerate(evidence, start=1)]

    def export(self, languages: list[str] | None = None, max_examples: int = 5000, distractors: int = 2,
               progress: Callable[[float, str], None] | None = None, seed: int = 13) -> dict[str, Any]:
        progress = progress or (lambda _f, _m: None)
        rng = random.Random(seed)
        languages = languages or self.settings.insight_languages
        pools: dict[str, list[EvidenceChunk]] = {}
        topics = self.insights.topics
        for i, topic in enumerate(topics):
            progress(0.5 * i / max(1, len(topics)), f"retrieving {topic.id}")
            pools[topic.id] = self.retriever.retrieve(topic.text("question", "en"), "en", k=6,
                                                      extra_queries=topic.queries).evidence
        examples: list[dict[str, Any]] = []
        counts = {"grounded": 0, "abstain": 0, "safety": 0}
        for i, topic in enumerate(topics):
            progress(0.5 + 0.5 * i / max(1, len(topics)), f"building {topic.id}")
            oracle = pools.get(topic.id) or []
            others = [e for tid, pool in pools.items() if tid != topic.id for e in pool]
            for lang in languages:
                insight = self.insights.get(f"{topic.id}.{lang}")
                questions = [topic.text("question", lang)] + (topic.queries if lang == "en" else [])
                for question in questions:
                    if len(oracle) >= 2 and insight is not None and insight.status == "published":
                        mixed = oracle[:4] + rng.sample(others, min(distractors, len(others)))
                        rng.shuffle(mixed)
                        mixed = self._renumber(mixed)
                        answer = self._answer_from_insight(insight, mixed, lang)
                        if answer:
                            examples.append(self._example(lang, question, mixed, insight.evidence.label, answer,
                                                          "grounded", topic.id))
                            counts["grounded"] += 1
                    if others and rng.random() < 0.25:  # abstention: only unrelated passages
                        unrelated = self._renumber(rng.sample(others, min(3, len(others))))
                        examples.append(self._example(lang, question, unrelated, "Insufficient",
                                                      t("abstain", lang), "abstain", topic.id))
                        counts["abstain"] += 1
        for rule, by_lang in SAFETY_SEEDS.items():
            for lang in languages:
                for prompt in by_lang.get(lang, []):
                    assessment = self.guardrails.check_input(prompt, lang)
                    message = " ".join(n.message for n in assessment.notices) or self.guardrails.message(rule, lang)
                    target = message if assessment.block_generation else f"{message}\n\n{t('next_step', lang)}"
                    examples.append(self._example(lang, prompt, [], "Insufficient", target, f"safety:{rule}", None))
                    counts["safety"] += 1
        rng.shuffle(examples)
        examples = examples[:max_examples]
        n_val = max(1, len(examples) // 20) if len(examples) > 20 else 0
        out_dir = self.settings.data_dir / "finetune"
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        train, val = out_dir / f"sft_{stamp}_train.jsonl", out_dir / f"sft_{stamp}_val.jsonl"
        for path, rows in ((train, examples[n_val:]), (val, examples[:n_val])):
            with path.open("w", encoding="utf-8") as handle:
                for row in rows:
                    handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        card = {
            "created": stamp, "prompt_version": PROMPT_VERSION, "languages": languages, "counts": counts,
            "train": train.name, "val": val.name, "n_train": len(examples) - n_val, "n_val": n_val,
            "review_required": "A clinician must review a random sample (≥5%) before training — see docs/BUILD_SPEC.md",
        }
        (out_dir / f"sft_{stamp}_card.json").write_text(json.dumps(card, indent=2), "utf-8")
        progress(1.0, "Done")
        return card

    def _example(self, lang: str, question: str, evidence: list[EvidenceChunk], grade: str, answer: str,
                 kind: str, topic_id: str | None) -> dict[str, Any]:
        return {
            "messages": [
                {"role": "system", "content": self._system(lang)},
                {"role": "user", "content": self._user(question, evidence, grade)},
                {"role": "assistant", "content": answer},
            ],
            "meta": {"kind": kind, "topic": topic_id, "language": lang, "prompt_version": PROMPT_VERSION},
        }

    def _answer_from_insight(self, insight, mixed: list[EvidenceChunk], lang: str) -> str:
        """Re-express a verified insight with citation numbers matching the shuffled evidence list."""
        by_chunk = {e.chunk_id: e.n for e in mixed}
        old_to_new = {c.n: by_chunk.get(c.chunk_id) for c in insight.citations}
        lines = []
        for point in insight.key_points + insight.recommendations:
            new = [old_to_new[n] for n in point.citations if old_to_new.get(n)]
            if new:
                lines.append(f"- {point.text} " + "".join(f"[{n}]" for n in sorted(set(new))))
        if not lines:
            return ""
        level = t("evidence_strength", lang, label=insight.evidence.label, grade=insight.evidence.grade)
        return "\n".join([*lines, "", level, t("next_step", lang)])
