# Stepwell model pipeline (`ml/`)

Fine-tunes a **Meta Llama** instruct model so that it behaves exactly as Stepwell needs. The model's knowledge
still comes from retrieval at answer time; fine-tuning teaches it the following behaviours:

- **Cite every claim:** each factual sentence ends with `[n]` markers that point to passages it was actually given.
- **Use only what the evidence says:** no statistics or claims that are absent from the passages.
- **Say "I don't know":** when the passages don't answer the question.
- **Put safety first:** emergencies, crisis and urgent symptoms during treatment get safety guidance, never a citation.
- **Answer in the person's language:** English, French, Spanish, Portuguese or German, even from English sources.
- **Use the right tone:** warm and plain language, never blaming, no diagnosis or treatment decisions.

## 1. Data: retrieval-augmented fine-tuning (RAFT)

Export the dataset from the running platform. In the admin console use **Export fine-tuning data**, or call
`POST /api/v1/admin/export/sft`. This writes `data/finetune/sft_<timestamp>_{train,val}.jsonl` plus a data card.

Each example is built with the **exact production prompt** (`backend/app/llm/prompts.py`, versioned by
`PROMPT_VERSION`). There are three kinds:

| kind | what it teaches |
|---|---|
| `grounded` | Answers re-expressed from verified, published insights. The relevant passages are shuffled with distractor passages from other topics, and the citation numbers are rewritten to match. |
| `abstain` | Only unrelated passages are given, so the model must say the evidence is insufficient. |
| `safety:<rule>` | Emergency, crisis, urgent-symptom and treatment-decision prompts in every language. |

```bash
pip install -e ".[dev]"                       # light install: data checks, review, evaluation
stepwell-ml check-data ../data/finetune/sft_*_train.jsonl
```

Validation rejects malformed chats, grounded answers without citations, citations to passages that don't exist,
and abstain or safety answers that cite anything. Exact duplicates are removed. Examples longer than
`max_seq_length` are **dropped, never truncated**: truncating evidence would teach the model to cite passages it
cannot see.

## 2. Clinical review gate (mandatory)

```bash
stepwell-ml review-sample ../data/finetune/sft_<ts>_train.jsonl        # writes a ≥5 % worksheet (.review.md)
# a clinician reviews accuracy, citations, tone, safety and language, then:
stepwell-ml review-approve ../data/finetune/sft_<ts>_train.jsonl --reviewer "Name, role" --sample-size 60
```

The approval is bound to the file's SHA-256. If the file changes afterwards, training refuses it until it is
reviewed again. `--allow-unreviewed` exists for local experiments only and is rejected when
`STEPWELL_ENV=production`.

## 3. Training (QLoRA)

```bash
pip install -e ".[train]"                     # torch, transformers, peft, bitsandbytes, accelerate
huggingface-cli login                         # accept the Llama licence on Hugging Face first
stepwell-ml train --config configs/llama31-8b-qlora.yaml --dry-run    # checks data + review, prints the plan
stepwell-ml train --config configs/llama31-8b-qlora.yaml
```

| config | base model | GPU | use |
|---|---|---|---|
| `llama31-8b-qlora.yaml` (default) | Llama 3.1 8B Instruct | 1× 24 GB | best quality/cost |
| `llama32-3b-qlora.yaml` | Llama 3.2 3B Instruct | 1× 12–16 GB | low-cost / edge |
| `llama33-70b-qlora.yaml` | Llama 3.3 70B Instruct | 1× 80 GB | highest quality |

All three officially support the platform's five languages.

How training works:

- **Model loading:** 4-bit NF4 weights with double quantisation and bf16 compute.
- **Adapters:** LoRA on every attention and MLP projection.
- **Loss masking:** loss is computed on the assistant reply only. The prompt and evidence are masked, and the end-of-turn token is learned.
- **Schedule:** cosine learning rate, paged 8-bit AdamW, gradient checkpointing, and early stopping on validation loss.
- **Mixing:** safety examples are upsampled three-fold (`kind_weights`).

Any value can be overridden, for example `--set training.max_steps=200 --set lora.r=32`.
A GPU container is in the `Dockerfile`.

Each run writes `models/<run>/adapter/` and a **run card** (`run_card.json`). The card records:

- the configuration, and the data file hashes with their review record;
- the git commit and library versions;
- the training and evaluation metrics;
- the Llama licence notice.

## 4. Serving

| option | command | API settings |
|---|---|---|
| vLLM + LoRA (recommended) | `VLLM_API_KEY=… serve/vllm.sh` | `LLM_BASE_URL=http://host:8001/v1` |
| merged weights | `stepwell-ml merge --config …` then `vllm serve models/<run>/merged` | same |
| Ollama / llama.cpp (CPU, laptops) | `serve/export_gguf.sh models/<run>/merged`, then `ollama create cancer-insights-llama -f serve/ollama/Modelfile` | `LLM_BASE_URL=http://host:11434/v1` |

In every case also set `LLM_PROVIDER=openai_compatible`, `LLM_MODEL=cancer-insights-llama` and `LLM_API_KEY`.
The API negotiates structured output automatically (JSON schema, then JSON object, then plain text). When the
model is unavailable it falls back to the extractive composer, so answers stay grounded.

## 5. Evaluation and release gates

```bash
stepwell-ml evaluate ../data/finetune/sft_<ts>_val.jsonl --base-url http://localhost:8001/v1 \
  --model cancer-insights-llama --config configs/llama31-8b-qlora.yaml --baseline previous_report.json
```

The evaluation writes `eval_report.json`, a Markdown summary and the raw predictions. It exits with code 1 if
any gate fails:

| gate | default |
|---|---|
| citation validity (every `[n]` exists) | ≥ 0.98 |
| citation coverage (factual sentences cited) | ≥ 0.85 |
| answers with numbers absent from the evidence | ≤ 0.02 |
| abstention accuracy | ≥ 0.90 |
| safety accuracy | 1.00 |
| language fidelity | ≥ 0.95 |
| regression against the previous model, per metric | ≤ 0.02 |

Missing metrics fail closed. Also run the platform-level evaluation (admin console → **Run evaluation**, or
`data/eval/*.jsonl`). That measures retrieval, groundedness after verification, abstention and safety end to end.

A model is promoted only when:

- every gate passes;
- the platform evaluation is at least as good as the current model;
- the clinical safety officer signs the report (`docs/BUILD_SPEC.md` §8).

## Licence

The code is MIT. Fine-tuned weights are derivatives of Meta Llama and are subject to the **Llama Community
License** and **Acceptable Use Policy**, including the "Built with Llama" attribution. `merge` writes a
`NOTICE.md` next to the weights. Never commit weights or data to the repository: `models/` and `data/finetune/`
are git-ignored.
