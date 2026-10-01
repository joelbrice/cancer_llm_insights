#!/usr/bin/env bash
# Merged model → GGUF (Q4_K_M) for llama.cpp / Ollama on CPUs, laptops or small GPUs.
# Requires a llama.cpp checkout (LLAMA_CPP_DIR) with its Python requirements installed.
set -euo pipefail
MERGED_DIR="${1:?usage: export_gguf.sh <merged-model-dir> [out-dir]}"
OUT_DIR="${2:-$(dirname "$0")/ollama}"
LLAMA_CPP_DIR="${LLAMA_CPP_DIR:?set LLAMA_CPP_DIR to a llama.cpp checkout}"
mkdir -p "$OUT_DIR"
python "$LLAMA_CPP_DIR/convert_hf_to_gguf.py" "$MERGED_DIR" --outtype bf16 --outfile "$OUT_DIR/stepwell-bf16.gguf"
"$LLAMA_CPP_DIR/build/bin/llama-quantize" "$OUT_DIR/stepwell-bf16.gguf" "$OUT_DIR/stepwell-q4_k_m.gguf" Q4_K_M
rm -f "$OUT_DIR/stepwell-bf16.gguf"
echo "Now: cd $OUT_DIR && ollama create cancer-insights-llama -f Modelfile"
