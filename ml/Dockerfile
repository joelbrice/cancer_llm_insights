# Training / evaluation image (GPU). Build: docker build -t stepwell-ml ml/
#   docker run --gpus all -v $PWD/data:/data -v $PWD/models:/models -e HF_TOKEN stepwell-ml \
#     train --config configs/llama31-8b-qlora.yaml --set data.train='["/data/finetune/sft_*_train.jsonl"]' \
#           --set data.val='["/data/finetune/sft_*_val.jsonl"]' --set training.output_dir=/models/stepwell-8b
FROM pytorch/pytorch:2.7.1-cuda12.6-cudnn9-runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/models/.hf
WORKDIR /app
COPY pyproject.toml ./
COPY stepwell_ml ./stepwell_ml
COPY configs ./configs
RUN pip install --no-cache-dir -e ".[train]"
RUN useradd --create-home --uid 10001 trainer && mkdir -p /models /data && chown trainer /models
USER trainer
ENTRYPOINT ["stepwell-ml"]
