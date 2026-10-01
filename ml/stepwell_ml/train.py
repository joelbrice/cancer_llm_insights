"""QLoRA supervised fine-tuning of a Llama instruct model on the Stepwell RAFT dataset.

Heavy dependencies (torch, transformers, peft, bitsandbytes) are imported lazily: `--dry-run` validates the
config, data and clinical review without a GPU.
"""

from __future__ import annotations

import json
import logging
import platform
import subprocess
from datetime import UTC, datetime
from typing import Any

from stepwell_ml import review
from stepwell_ml.config import Config
from stepwell_ml.data import build_features, load_examples, resolve_files, sha256_file

log = logging.getLogger("stepwell_ml.train")

LICENSE_NOTICE = ("Weights derived from Meta Llama are subject to the Llama Community License and Acceptable Use "
                  "Policy, including the \"Built with Llama\" attribution. The adapter alone is MIT-compatible code "
                  "output but is unusable without the licensed base model.")


class ReviewRequired(RuntimeError):
    pass


def _git_commit() -> str | None:
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=5, check=True).stdout.strip()
    except Exception:
        return None


def prepare(cfg: Config, allow_unreviewed: bool = False) -> dict[str, Any]:
    """Resolve and check data files; returns the data plan (raises when the review gate is not met)."""
    train_files = resolve_files(cfg.data.train, cfg.base_dir, cfg.data.latest_only)
    val_files = resolve_files(cfg.data.val, cfg.base_dir, cfg.data.latest_only)
    if not train_files:
        raise FileNotFoundError(f"no training files match {cfg.data.train} (export them from the admin console)")
    reviews = {}
    for f in train_files:
        ok, message = review.check(f)
        reviews[f.name] = message
        if not ok and cfg.data.require_review and not allow_unreviewed:
            raise ReviewRequired(message)
    train, train_report = load_examples(train_files, cfg.data.kind_weights, cfg.data.languages, cfg.training.seed)
    val, val_report = load_examples(val_files, None, cfg.data.languages, cfg.training.seed) if val_files else ([], None)
    if not train:
        raise ValueError(f"no valid training examples: {train_report.errors[:5]}")
    return {"train": train, "val": val, "train_report": train_report.as_dict(),
            "val_report": val_report.as_dict() if val_report else None, "reviews": reviews,
            "files": {str(f): sha256_file(f) for f in [*train_files, *val_files]}}


def train(cfg: Config, *, allow_unreviewed: bool = False, dry_run: bool = False, resume: bool = False) -> dict[str, Any]:
    plan = prepare(cfg, allow_unreviewed)
    out_dir = cfg.path(cfg.training.output_dir)
    summary = {"run_name": cfg.run_name, "base_model": cfg.base_model, "output_dir": str(out_dir),
               "train_examples": len(plan["train"]), "val_examples": len(plan["val"]),
               "train_report": plan["train_report"], "reviews": plan["reviews"]}
    if dry_run:
        return summary

    import torch
    import transformers
    from peft import LoraConfig as PeftLoraConfig
    from peft import get_peft_model, prepare_model_for_kbit_training
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
        DataCollatorForSeq2Seq,
        EarlyStoppingCallback,
        Trainer,
        TrainingArguments,
    )

    transformers.set_seed(cfg.training.seed)
    tokenizer = AutoTokenizer.from_pretrained(cfg.base_model, use_fast=True)
    if tokenizer.pad_token is None:
        reserved = "<|finetune_right_pad_id|>"  # Llama 3.1+ reserves a dedicated padding token
        tokenizer.pad_token = reserved if reserved in tokenizer.get_vocab() else tokenizer.eos_token
    tokenizer.padding_side = "right"

    def features(examples):
        rows, dropped = [], 0
        for ex in examples:
            f = build_features(tokenizer, ex.messages, cfg.data.max_seq_length)
            if f is None:
                dropped += 1
            else:
                rows.append(f)
        return rows, dropped

    train_rows, train_dropped = features(plan["train"])
    val_rows, val_dropped = features(plan["val"])
    log.info("tokenised %d train (%d too long), %d val (%d too long)", len(train_rows), train_dropped, len(val_rows),
             val_dropped)

    dtype = getattr(torch, cfg.quantization.compute_dtype)
    quant = None
    if cfg.quantization.load_in_4bit:
        quant = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type=cfg.quantization.quant_type,
                                   bnb_4bit_use_double_quant=cfg.quantization.double_quant,
                                   bnb_4bit_compute_dtype=dtype)
    model = AutoModelForCausalLM.from_pretrained(cfg.base_model, quantization_config=quant, dtype=dtype,
                                                 attn_implementation=cfg.training.attn_implementation,
                                                 device_map="auto")
    model.config.use_cache = False
    if quant is not None:
        model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=cfg.training.gradient_checkpointing)
    model = get_peft_model(model, PeftLoraConfig(r=cfg.lora.r, lora_alpha=cfg.lora.alpha, lora_dropout=cfg.lora.dropout,
                                                 target_modules=cfg.lora.target_modules, bias="none",
                                                 task_type="CAUSAL_LM"))
    model.print_trainable_parameters()

    t = cfg.training
    has_val = bool(val_rows)
    args = TrainingArguments(
        output_dir=str(out_dir / "checkpoints"), run_name=cfg.run_name, num_train_epochs=t.epochs,
        max_steps=t.max_steps, learning_rate=t.learning_rate, lr_scheduler_type=t.lr_scheduler,
        warmup_ratio=t.warmup_ratio, weight_decay=t.weight_decay, per_device_train_batch_size=t.per_device_batch_size,
        per_device_eval_batch_size=t.per_device_batch_size, gradient_accumulation_steps=t.gradient_accumulation_steps,
        max_grad_norm=t.max_grad_norm, logging_steps=t.logging_steps,
        eval_strategy="steps" if has_val else "no", eval_steps=t.eval_steps if has_val else None,
        save_strategy="steps", save_steps=t.save_steps, save_total_limit=3,
        load_best_model_at_end=has_val, metric_for_best_model="eval_loss", greater_is_better=False,
        bf16=cfg.quantization.compute_dtype == "bfloat16", fp16=cfg.quantization.compute_dtype == "float16",
        gradient_checkpointing=t.gradient_checkpointing, gradient_checkpointing_kwargs={"use_reentrant": False},
        optim=t.optim, group_by_length=True, remove_unused_columns=False, report_to=t.report_to, seed=t.seed,
    )
    trainer = Trainer(
        model=model, args=args, train_dataset=train_rows, eval_dataset=val_rows or None,
        data_collator=DataCollatorForSeq2Seq(tokenizer, padding=True, label_pad_token_id=-100, pad_to_multiple_of=8),
        callbacks=[EarlyStoppingCallback(t.early_stopping_patience)] if has_val else None,
    )
    result = trainer.train(resume_from_checkpoint=resume or None)
    adapter_dir = out_dir / "adapter"
    trainer.model.save_pretrained(adapter_dir)
    tokenizer.save_pretrained(adapter_dir)
    eval_metrics = trainer.evaluate() if has_val else {}

    card = {
        **summary, "created": datetime.now(UTC).isoformat(), "git_commit": _git_commit(), "config": cfg.as_dict(),
        "data_files": plan["files"], "dropped_too_long": {"train": train_dropped, "val": val_dropped},
        "train_metrics": result.metrics, "eval_metrics": eval_metrics, "adapter_dir": str(adapter_dir),
        "versions": {"python": platform.python_version(), "torch": torch.__version__,
                     "transformers": transformers.__version__},
        "license": LICENSE_NOTICE,
        "next_steps": "Serve the adapter (ml/serve/vllm.sh) and run `stepwell-ml evaluate`: deploy only if every "
                      "release gate passes and the clinical safety officer signs the evaluation report.",
    }
    (out_dir / "run_card.json").write_text(json.dumps(card, indent=2, default=str), encoding="utf-8")
    return card


def summary_text(result: dict[str, Any]) -> str:
    report = result.get("train_report", {})
    return (f"{result['run_name']}: {result['train_examples']} training / {result['val_examples']} validation examples "
            f"(kinds {report.get('by_kind')}, languages {report.get('by_language')}, invalid {report.get('invalid')}, "
            f"duplicates {report.get('duplicates')}) → {result['output_dir']}")


__all__ = ["LICENSE_NOTICE", "ReviewRequired", "prepare", "summary_text", "train"]
