import json
from pathlib import Path

import pytest

SYSTEM = {"role": "system", "content": "You are Stepwell. Answer only from the evidence."}


def user(question: str, passages: dict[int, str]) -> dict[str, str]:
    body = "\n\n".join(f'[{n}] Source {n} (Meta-analysis, 2022)\n"""{text}"""' for n, text in passages.items())
    return {"role": "user", "content": f'<evidence grade="High">\n{body}\n</evidence>\n\nQuestion: {question}'}


GROUNDED = {
    "messages": [SYSTEM, user("Does exercise reduce fatigue during chemotherapy?",
                              {1: "Supervised exercise during chemotherapy reduced cancer-related fatigue in 24 trials.",
                               2: "Unrelated passage about sunscreen use and melanoma risk."}),
                 {"role": "assistant", "content": "- Supervised exercise during chemotherapy reduced cancer-related "
                                                  "fatigue across 24 trials [1].\n\nThe evidence is strong (A).\n"
                                                  "Talk with your care team before starting."}],
    "meta": {"kind": "grounded", "language": "en", "topic": "cancer-related-fatigue"},
}
ABSTAIN = {
    "messages": [SYSTEM, user("Does radon cause lung cancer?", {1: "Sunscreen use and melanoma risk in adults."}),
                 {"role": "assistant", "content": "The library does not contain enough evidence to answer this."}],
    "meta": {"kind": "abstain", "language": "en"},
}
SAFETY = {
    "messages": [SYSTEM, {"role": "user", "content": "<evidence grade=\"Insufficient\">\n\n</evidence>\n\nQuestion: "
                                                     "I want to end my life"},
                 {"role": "assistant", "content": "Please call 112 or 988 now. You deserve support right away."}],
    "meta": {"kind": "safety:self_harm", "language": "en"},
}


def write_jsonl(path: Path, rows: list[dict]) -> Path:
    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    return path


@pytest.fixture()
def dataset(tmp_path: Path) -> Path:
    finetune = tmp_path / "data" / "finetune"
    finetune.mkdir(parents=True)
    write_jsonl(finetune / "sft_20261001T000000Z_train.jsonl", [GROUNDED, ABSTAIN, SAFETY, GROUNDED])
    write_jsonl(finetune / "sft_20261001T000000Z_val.jsonl", [GROUNDED, ABSTAIN, SAFETY])
    return finetune


class FakeTokenizer:
    """Character-level stand-in with a Llama-3-like, prefix-stable chat template."""

    def apply_chat_template(self, messages, add_generation_prompt=False, tokenize=True):
        text = "".join(f"<{m['role']}>{m['content']}<eot>" for m in messages)
        if add_generation_prompt:
            text += "<assistant>"
        return [ord(c) for c in text] if tokenize else text
