#!/usr/bin/env bash
# Serve the base Llama model with the Stepwell LoRA adapter through vLLM's OpenAI-compatible API.
# The API then uses: LLM_PROVIDER=openai_compatible LLM_BASE_URL=http://<host>:8001/v1 LLM_MODEL=cancer-insights-llama
# vLLM also honours response_format=json_schema, which the insight engine uses for structured output.
set -euo pipefail
BASE_MODEL="${BASE_MODEL:-meta-llama/Llama-3.1-8B-Instruct}"
ADAPTER_DIR="${ADAPTER_DIR:-$(dirname "$0")/../../models/stepwell-llama31-8b-qlora/adapter}"
SERVED_MODEL_NAME="${SERVED_MODEL_NAME:-cancer-insights-llama}"
: "${VLLM_API_KEY:?set VLLM_API_KEY (the API sends it as LLM_API_KEY)}"
exec vllm serve "$BASE_MODEL" \
  --enable-lora --lora-modules "$SERVED_MODEL_NAME=$ADAPTER_DIR" --max-lora-rank "${MAX_LORA_RANK:-64}" \
  --max-model-len "${MAX_MODEL_LEN:-8192}" --gpu-memory-utilization "${GPU_MEMORY_UTILIZATION:-0.90}" \
  --tensor-parallel-size "${TENSOR_PARALLEL_SIZE:-1}" --host 0.0.0.0 --port "${PORT:-8001}" \
  --api-key "$VLLM_API_KEY" --generation-config vllm --disable-log-requests
