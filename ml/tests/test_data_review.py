import copy

import pytest

from stepwell_ml import review
from stepwell_ml.data import TemplateMismatch, build_features, load_examples, resolve_files, validate
from tests.conftest import ABSTAIN, GROUNDED, SAFETY, FakeTokenizer, write_jsonl


def test_validation_enforces_grounding_rules():
    assert validate(GROUNDED) == [] and validate(ABSTAIN) == [] and validate(SAFETY) == []
    bad = copy.deepcopy(GROUNDED)
    bad["messages"][-1]["content"] = "Exercise helps [3]."
    assert "citations [3] not among passages [1, 2]" in validate(bad)[0]
    uncited = copy.deepcopy(GROUNDED)
    uncited["messages"][-1]["content"] = "Exercise helps."
    assert validate(uncited) == ["grounded answer without citations"]
    citing_abstain = copy.deepcopy(ABSTAIN)
    citing_abstain["messages"][-1]["content"] = "Not enough evidence [1]."
    assert validate(citing_abstain) == ["abstain answer must not cite passages"]
    assert validate({"messages": [{"role": "assistant", "content": "hi"}]})[0].startswith("roles must end")


def test_loading_dedupes_filters_and_upsamples(tmp_path):
    f = write_jsonl(tmp_path / "x.jsonl", [GROUNDED, GROUNDED, ABSTAIN, SAFETY, {"messages": []}])
    examples, report = load_examples([f], {"safety": 3.0, "abstain": 0.0})
    assert report.duplicates == 1 and report.invalid == 1
    assert report.by_kind == {"grounded": 1, "safety": 3}
    assert len(examples) == 4
    only_fr, _ = load_examples([f], languages=["fr"])
    assert only_fr == []


def test_assistant_only_labels_and_length_policy():
    tok = FakeTokenizer()
    features = build_features(tok, GROUNDED["messages"], max_length=10_000)
    prompt_len = len(tok.apply_chat_template(GROUNDED["messages"][:-1], add_generation_prompt=True))
    assert features["labels"][:prompt_len] == [-100] * prompt_len
    assert features["labels"][prompt_len:] == features["input_ids"][prompt_len:]
    assert "".join(map(chr, features["labels"][prompt_len:])).endswith("<eot>")  # learns to stop
    assert build_features(tok, GROUNDED["messages"], max_length=50) is None  # dropped, never truncated

    class Unstable(FakeTokenizer):
        def apply_chat_template(self, messages, add_generation_prompt=False, tokenize=True):
            return super().apply_chat_template(messages, False, tokenize)[::-1]

    with pytest.raises(TemplateMismatch):
        build_features(Unstable(), GROUNDED["messages"], 10_000)


def test_latest_export_is_selected(dataset):
    write_jsonl(dataset / "sft_20261101T000000Z_train.jsonl", [GROUNDED])
    files = resolve_files(["sft_*_train.jsonl"], dataset)
    assert [f.name for f in files] == ["sft_20261101T000000Z_train.jsonl"]
    assert len(resolve_files(["sft_*_train.jsonl"], dataset, latest_only=False)) == 2


def test_clinical_review_is_bound_to_the_exact_file(dataset, tmp_path):
    train = dataset / "sft_20261001T000000Z_train.jsonl"
    assert review.check(train)[0] is False
    worksheet = tmp_path / "sheet.md"
    assert review.sample(train, worksheet, minimum=2) == 2 and "**Answer:**" in worksheet.read_text()
    review.approve(train, "Dr Example (clinical safety officer)", sample_size=2)
    ok, message = review.check(train)
    assert ok and "approved by Dr Example" in message
    train.write_text(train.read_text() + "\n")  # any change invalidates the approval
    assert review.check(train) == (False, f"{train.name} changed after review; it must be reviewed again")
    review.approve(train, "Dr Example", 2, notes="tone too clinical in 3 answers", approved=False)
    assert "not approved" in review.check(train)[1]
