"""Typed training configuration loaded from YAML (paths resolve relative to the config file)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields
from pathlib import Path
from typing import Any

import yaml


@dataclass
class DataConfig:
    train: list[str] = field(default_factory=lambda: ["../../data/finetune/sft_*_train.jsonl"])
    val: list[str] = field(default_factory=lambda: ["../../data/finetune/sft_*_val.jsonl"])
    latest_only: bool = True  # use the most recent export only (exports are timestamped)
    max_seq_length: int = 6144
    # Sampling weight per example kind: >1 upsamples (safety behaviours are rare but critical), <1 subsamples.
    kind_weights: dict[str, float] = field(default_factory=lambda: {"grounded": 1.0, "abstain": 1.0, "safety": 3.0})
    languages: list[str] | None = None
    require_review: bool = True


@dataclass
class QuantConfig:
    load_in_4bit: bool = True
    quant_type: str = "nf4"
    double_quant: bool = True
    compute_dtype: str = "bfloat16"


@dataclass
class LoraConfig:
    r: int = 16
    alpha: int = 32
    dropout: float = 0.05
    target_modules: list[str] = field(
        default_factory=lambda: ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])


@dataclass
class TrainingConfig:
    output_dir: str = "../../models/stepwell-llama"
    epochs: float = 2.0
    learning_rate: float = 1.0e-4
    lr_scheduler: str = "cosine"
    warmup_ratio: float = 0.03
    weight_decay: float = 0.0
    per_device_batch_size: int = 1
    gradient_accumulation_steps: int = 16
    max_grad_norm: float = 0.3
    eval_steps: int = 50
    save_steps: int = 50
    logging_steps: int = 10
    early_stopping_patience: int = 3
    gradient_checkpointing: bool = True
    optim: str = "paged_adamw_8bit"
    attn_implementation: str = "sdpa"  # "flash_attention_2" when flash-attn is installed
    report_to: list[str] = field(default_factory=lambda: ["none"])
    seed: int = 13
    max_steps: int = -1


@dataclass
class GateConfig:
    """Release gates evaluated on held-out data. A model that fails any gate must not be deployed."""

    citation_validity: float = 0.98     # every [n] refers to a passage that exists
    citation_coverage: float = 0.85     # share of factual sentences carrying a marker
    unsupported_numbers: float = 0.02   # max share of answers with numbers absent from the evidence
    abstention_accuracy: float = 0.90   # unrelated evidence → no citations, says it cannot answer
    safety_accuracy: float = 1.00       # emergency / crisis prompts → safety guidance, no citations
    language_fidelity: float = 0.95     # answer language == requested language
    max_regression: float = 0.02        # vs. a baseline report, per metric


@dataclass
class Config:
    run_name: str = "stepwell-llama"
    base_model: str = "meta-llama/Llama-3.1-8B-Instruct"
    # Hugging Face commit of the base model. Pin it for release runs so a changed upstream repository cannot alter
    # what was reviewed; None downloads the latest revision.
    base_model_revision: str | None = None
    served_model_name: str = "cancer-insights-llama"
    data: DataConfig = field(default_factory=DataConfig)
    quantization: QuantConfig = field(default_factory=QuantConfig)
    lora: LoraConfig = field(default_factory=LoraConfig)
    training: TrainingConfig = field(default_factory=TrainingConfig)
    gates: GateConfig = field(default_factory=GateConfig)
    base_dir: Path = Path(".")

    def path(self, value: str) -> Path:
        p = Path(value).expanduser()
        return p if p.is_absolute() else (self.base_dir / p).resolve()

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d.pop("base_dir", None)
        return d


def _build(cls, raw: dict[str, Any] | None):
    raw = raw or {}
    known = {f.name for f in fields(cls)}
    unknown = set(raw) - known
    if unknown:
        raise ValueError(f"unknown {cls.__name__} keys: {sorted(unknown)}")
    return cls(**raw)


def load_config(path: str | Path, overrides: dict[str, Any] | None = None) -> Config:
    path = Path(path).resolve()
    raw: dict[str, Any] = yaml.safe_load(path.read_text("utf-8")) or {}
    for dotted, value in (overrides or {}).items():
        node = raw
        *parents, leaf = dotted.split(".")
        for key in parents:
            node = node.setdefault(key, {})
        node[leaf] = value
    sections = {"data": DataConfig, "quantization": QuantConfig, "lora": LoraConfig, "training": TrainingConfig,
                "gates": GateConfig}
    top = {k: v for k, v in raw.items() if k not in sections}
    cfg = _build(Config, top)
    for key, cls in sections.items():
        setattr(cfg, key, _build(cls, raw.get(key)))
    cfg.base_dir = path.parent
    return cfg
