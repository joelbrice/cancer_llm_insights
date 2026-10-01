import copy
import json
from pathlib import Path

import pytest

from stepwell_ml.cli import main
from stepwell_ml.config import GateConfig, load_config
from stepwell_ml.metrics import aggregate, detect_language, gates, score
from stepwell_ml.train import ReviewRequired, train
from tests.conftest import ABSTAIN, GROUNDED, SAFETY


def test_scoring_rewards_grounded_honest_and_safe_answers():
    good = score(GROUNDED["messages"], GROUNDED["messages"][-1]["content"], GROUNDED["meta"])
    assert good.citation_valid and good.citation_coverage == 1.0 and not good.unsupported_numbers
    invented = score(GROUNDED["messages"], "- Exercise cut fatigue by 37% in 24 trials [1].", GROUNDED["meta"])
    assert invented.unsupported_numbers  # 37 is not in the evidence
    phantom = score(GROUNDED["messages"], "- Exercise during chemotherapy reduces fatigue for most people [4].",
                    GROUNDED["meta"])
    assert not phantom.citation_valid
    assert score(ABSTAIN["messages"], ABSTAIN["messages"][-1]["content"], ABSTAIN["meta"]).abstained_correctly
    assert not score(ABSTAIN["messages"], "Radon is linked to lung cancer [1].", ABSTAIN["meta"]).abstained_correctly
    assert score(SAFETY["messages"], "Call 112 now, please.", SAFETY["meta"]).safety_ok
    assert not score(SAFETY["messages"], "Try to relax and drink water.", SAFETY["meta"]).safety_ok
    assert detect_language("Les preuves montrent que l'activité physique réduit le risque de cancer du côlon") == "fr"


def test_gates_fail_closed_and_catch_regressions():
    metrics = aggregate([score(r["messages"], r["messages"][-1]["content"], r["meta"]) for r in (GROUNDED, ABSTAIN, SAFETY)])
    assert gates(metrics, GateConfig()) == []
    assert gates({**metrics, "safety_accuracy": None}, GateConfig()) == ["safety_accuracy: no examples to evaluate"]
    worse = {**metrics, "citation_coverage": 0.86}
    assert gates(worse, GateConfig(), baseline=metrics) == ["citation_coverage: regressed from 1.000 to 0.860"]


def test_evaluate_predictions_via_cli(dataset, tmp_path):
    val = dataset / "sft_20261001T000000Z_val.jsonl"
    preds = tmp_path / "preds.jsonl"
    rows = [json.loads(line) for line in val.read_text().splitlines()]
    preds.write_text("\n".join(json.dumps({"prediction": r["messages"][-1]["content"]}) for r in rows))
    out = tmp_path / "report.json"
    assert main(["evaluate", str(val), "--predictions", str(preds), "--out", str(out)]) == 0
    assert json.loads(out.read_text())["gates_passed"] and "PASSED" in out.with_suffix(".md").read_text()
    bad = tmp_path / "bad.jsonl"
    bad.write_text("\n".join(json.dumps({"prediction": "Sure! [9]"}) for _ in rows))
    assert main(["evaluate", str(val), "--predictions", str(bad), "--out", str(tmp_path / "r2.json")]) == 1


def _config(tmp_path: Path, dataset: Path) -> Path:
    cfg = Path(__file__).resolve().parents[1] / "configs" / "llama31-8b-qlora.yaml"
    text = cfg.read_text().replace("../../data/finetune", str(dataset)).replace("../../models", str(tmp_path / "models"))
    path = tmp_path / "config.yaml"
    path.write_text(text)
    return path


def test_training_requires_clinical_review_then_plans_the_run(dataset, tmp_path):
    cfg = load_config(_config(tmp_path, dataset))
    assert cfg.base_model == "meta-llama/Llama-3.1-8B-Instruct" and cfg.data.kind_weights["safety"] == 3.0
    with pytest.raises(ReviewRequired):
        train(cfg, dry_run=True)
    assert main(["train", "--config", str(_config(tmp_path, dataset)), "--dry-run"]) == 3
    assert main(["review-approve", str(dataset / "sft_20261001T000000Z_train.jsonl"), "--reviewer", "Dr R",
                 "--sample-size", "4"]) == 0
    plan = train(cfg, dry_run=True)
    assert plan["train_examples"] == 5 and plan["val_examples"] == 3  # 1 grounded (deduped) + 1 abstain + 3× safety
    assert plan["reviews"]["sft_20261001T000000Z_train.jsonl"].startswith("approved by Dr R")


def test_config_overrides_and_unknown_keys(tmp_path, dataset):
    path = _config(tmp_path, dataset)
    cfg = load_config(path, {"training.max_steps": 10, "lora.r": 8})
    assert cfg.training.max_steps == 10 and cfg.lora.r == 8
    broken = tmp_path / "broken.yaml"
    broken.write_text(path.read_text() + "\nlora_typo: 1\n")
    with pytest.raises(ValueError, match="unknown Config keys"):
        load_config(broken)
    typo = tmp_path / "typo.yaml"
    typo.write_text(path.read_text().replace("  r: 16", "  rank: 16"))
    with pytest.raises(ValueError, match="unknown LoraConfig keys"):
        load_config(typo)


def test_allow_unreviewed_is_refused_in_production(dataset, tmp_path, monkeypatch):
    monkeypatch.setenv("STEPWELL_ENV", "production")
    assert main(["train", "--config", str(_config(tmp_path, dataset)), "--dry-run", "--allow-unreviewed"]) == 2


def test_safety_examples_must_not_cite():
    bad = copy.deepcopy(SAFETY)
    bad["messages"][-1]["content"] = "Call 112 [1]"
    assert not score(bad["messages"], bad["messages"][-1]["content"], bad["meta"]).safety_ok
