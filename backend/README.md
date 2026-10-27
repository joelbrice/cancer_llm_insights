# Stepwell engine (backend)

FastAPI service that turns a curated research library into evidence-graded, cited answers and insights. It also
hosts the moderated community. See the repository README for the overview and `docs/ARCHITECTURE.md` for the design.

```bash
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"            # add ,prod / ,models / ,buckets as needed
cancer-insights doctor             # configuration + connectivity checks
cancer-insights ingest             # index the linked sources (data/sources.yaml)
cancer-insights serve --reload     # http://localhost:8000/docs
pytest && ruff check app tests
```
