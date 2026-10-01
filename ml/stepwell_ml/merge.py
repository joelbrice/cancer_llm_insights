"""Merge a trained LoRA adapter into its base model (for llama.cpp/Ollama export or adapter-free serving)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from stepwell_ml.train import LICENSE_NOTICE


def merge(adapter_dir: Path, base_model: str, out_dir: Path, dtype: str = "bfloat16") -> Path:
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    base = AutoModelForCausalLM.from_pretrained(base_model, dtype=getattr(torch, dtype), device_map="cpu")
    merged = PeftModel.from_pretrained(base, str(adapter_dir)).merge_and_unload()
    out_dir.mkdir(parents=True, exist_ok=True)
    merged.save_pretrained(out_dir, safe_serialization=True, max_shard_size="5GB")
    AutoTokenizer.from_pretrained(adapter_dir).save_pretrained(out_dir)
    card = adapter_dir.parent / "run_card.json"
    if card.exists():
        shutil.copy(card, out_dir / "run_card.json")
    (out_dir / "NOTICE.md").write_text(
        f"# Stepwell fine-tuned model\n\nBase model: `{base_model}`. Built with Llama.\n\n{LICENSE_NOTICE}\n\n"
        "Intended use: grounded, cited answers about cancer prevention and living with/after cancer for individuals, "
        "behind the Stepwell retrieval and safety layers. Not for diagnosis, treatment decisions or unsupervised use.\n",
        encoding="utf-8")
    (out_dir / "stepwell.json").write_text(json.dumps({"adapter": str(adapter_dir), "base_model": base_model}), "utf-8")
    return out_dir
