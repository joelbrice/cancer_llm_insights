# Stepwell API / worker image.
#   docker build -t stepwell-api backend/                         # lean: hashing embeddings, remote LLM
#   docker build -t stepwell-api --build-arg EXTRAS=prod,models backend/   # + local multilingual-e5 embeddings
FROM python:3.12-slim AS build
ARG EXTRAS=prod
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_ONLY_BINARY=lxml,numpy,psycopg-binary
WORKDIR /src
COPY pyproject.toml README.md ./
COPY app ./app
RUN python -m venv /opt/venv && /opt/venv/bin/pip install --upgrade pip \
 && if echo ",$EXTRAS," | grep -q ",models,"; then \
      /opt/venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu; fi \
 && /opt/venv/bin/pip install ".[${EXTRAS}]"

FROM python:3.12-slim
LABEL org.opencontainers.image.title="stepwell-api" org.opencontainers.image.licenses="MIT"
ENV PATH=/opt/venv/bin:$PATH PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DATA_DIR=/data HF_HOME=/models/huggingface ENVIRONMENT=production LOG_JSON=true
# No OS packages needed: every dependency ships manylinux wheels (smaller image, fewer CVEs to patch).
RUN useradd --create-home --uid 10001 stepwell && mkdir -p /data /models && chown -R stepwell /data /models
COPY --from=build /opt/venv /opt/venv
WORKDIR /app
USER stepwell
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=3)"]
# API: default command. Worker: `python -m app.workers.worker`. Operations: `cancer-insights --help`.
CMD ["cancer-insights", "serve", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
