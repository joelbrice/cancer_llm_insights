"""stepwell-ml: check-data · review-sample · review-approve · train · merge · evaluate."""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from stepwell_ml import review
from stepwell_ml.config import GateConfig, load_config
from stepwell_ml.data import load_examples


def _overrides(pairs: list[str]) -> dict:
    out = {}
    for pair in pairs:
        key, _, raw = pair.partition("=")
        try:
            out[key] = json.loads(raw)
        except json.JSONDecodeError:
            out[key] = raw
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="stepwell-ml", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("check-data", help="validate an exported dataset")
    p.add_argument("files", nargs="+", type=Path)

    p = sub.add_parser("review-sample", help="write a clinical review worksheet")
    p.add_argument("train_file", type=Path)
    p.add_argument("--out", type=Path)
    p.add_argument("--fraction", type=float, default=0.05)
    p.add_argument("--minimum", type=int, default=30)

    p = sub.add_parser("review-approve", help="record the clinical review outcome")
    p.add_argument("train_file", type=Path)
    p.add_argument("--reviewer", required=True)
    p.add_argument("--sample-size", type=int, required=True)
    p.add_argument("--notes", default="")
    p.add_argument("--reject", action="store_true")

    p = sub.add_parser("train", help="QLoRA fine-tuning")
    p.add_argument("--config", type=Path, required=True)
    p.add_argument("--set", action="append", default=[], metavar="KEY=VALUE", help="e.g. training.max_steps=50")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--resume", action="store_true")
    p.add_argument("--allow-unreviewed", action="store_true", help="development only; refused when STEPWELL_ENV=production")

    p = sub.add_parser("merge", help="merge the adapter into the base model")
    p.add_argument("--config", type=Path, required=True)
    p.add_argument("--out", type=Path)

    p = sub.add_parser("evaluate", help="behavioural evaluation + release gates")
    p.add_argument("dataset", type=Path)
    p.add_argument("--config", type=Path, help="gate thresholds (defaults if omitted)")
    p.add_argument("--base-url", default=os.environ.get("LLM_BASE_URL"))
    p.add_argument("--model", default=os.environ.get("LLM_MODEL"))
    p.add_argument("--predictions", type=Path)
    p.add_argument("--baseline", type=Path, help="previous report: fail on regressions")
    p.add_argument("--limit", type=int)
    p.add_argument("--out", type=Path, default=Path("eval_report.json"))

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.command == "check-data":
        _, report = load_examples(args.files)
        print(json.dumps(report.as_dict(), indent=2, ensure_ascii=False))
        return 1 if report.invalid else 0
    if args.command == "review-sample":
        out = args.out or args.train_file.with_suffix(".review.md")
        n = review.sample(args.train_file, out, args.fraction, args.minimum)
        print(f"wrote {n} examples to {out}")
        return 0
    if args.command == "review-approve":
        record = review.approve(args.train_file, args.reviewer, args.sample_size, args.notes, approved=not args.reject)
        print(json.dumps(record, indent=2))
        return 0
    if args.command == "train":
        if args.allow_unreviewed and os.environ.get("STEPWELL_ENV") == "production":
            print("--allow-unreviewed is not permitted in production", file=sys.stderr)
            return 2
        from stepwell_ml.train import ReviewRequired, summary_text, train

        cfg = load_config(args.config, _overrides(args.set))
        try:
            result = train(cfg, allow_unreviewed=args.allow_unreviewed, dry_run=args.dry_run, resume=args.resume)
        except ReviewRequired as exc:
            print(f"clinical review required: {exc}", file=sys.stderr)
            return 3
        print(summary_text(result))
        return 0
    if args.command == "merge":
        from stepwell_ml.merge import merge

        cfg = load_config(args.config)
        out_dir = cfg.path(cfg.training.output_dir)
        print(merge(out_dir / "adapter", cfg.base_model, args.out or out_dir / "merged"))
        return 0
    if args.command == "evaluate":
        from stepwell_ml.evaluate import run

        gates_cfg = load_config(args.config).gates if args.config else GateConfig()
        report = run(args.dataset, gates_config=gates_cfg, base_url=args.base_url, model=args.model,
                     api_key=os.environ.get("LLM_API_KEY"), predictions=args.predictions, baseline=args.baseline,
                     limit=args.limit, out=args.out)
        print(json.dumps({"metrics": report["metrics"], "failures": report["failures"]}, indent=2))
        return 0 if report["gates_passed"] else 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
