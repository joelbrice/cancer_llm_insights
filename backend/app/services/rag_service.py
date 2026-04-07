"""
RAG Service - Retrieval-Augmented Generation using ChromaDB.

Manages a vector store of cancer research documents.
Documents are ingested from PDFs, JSON files, or plain text.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Sample research snippets bundled with the application
# In production, replace/augment these with real ingested documents
SEED_DOCUMENTS = [
    {
        "id": "wcrf_2018_diet",
        "content": (
            "The World Cancer Research Fund (WCRF) 2018 report recommends: "
            "be a healthy weight; be physically active; eat a diet rich in whole grains, "
            "vegetables, fruit, and beans; limit consumption of 'fast foods' and other "
            "processed foods high in fat, starches or sugars; limit consumption of red and "
            "processed meat; limit consumption of sugar-sweetened drinks; limit alcohol; "
            "do not use supplements for cancer prevention; for mothers, breastfeed your baby; "
            "after a cancer diagnosis, follow these recommendations."
        ),
        "metadata": {"source": "WCRF/AICR", "year": 2018, "topic": "lifestyle"},
    },
    {
        "id": "iarc_tobacco",
        "content": (
            "Tobacco smoking is causally related to cancers of the lung, larynx, oral cavity, "
            "pharynx, oesophagus, stomach, pancreas, kidney, bladder, cervix, and acute myeloid "
            "leukaemia (IARC Group 1). Smokeless tobacco is causally related to cancers of the "
            "oral cavity, oesophagus, and pancreas."
        ),
        "metadata": {"source": "IARC Monographs Vol 100E", "year": 2012, "topic": "tobacco"},
    },
    {
        "id": "aicr_obesity",
        "content": (
            "Strong evidence shows that excess body fat increases risk of cancers of the "
            "oesophagus (adenocarcinoma), pancreas, liver, colorectum, breast (postmenopause), "
            "endometrium, ovary, and kidney. Obesity is also associated with poorer cancer "
            "outcomes and overall mortality."
        ),
        "metadata": {"source": "AICR Cancer Prevention Report", "year": 2018, "topic": "obesity"},
    },
    {
        "id": "acs_physical_activity",
        "content": (
            "The American Cancer Society recommends adults get 150–300 minutes of moderate-intensity "
            "or 75–150 minutes of vigorous-intensity activity per week. Higher amounts provide "
            "greater benefit. Physical activity has been shown to reduce risk of colon, breast, "
            "and endometrial cancers."
        ),
        "metadata": {"source": "American Cancer Society Guidelines 2020", "year": 2020, "topic": "exercise"},
    },
    {
        "id": "who_alcohol",
        "content": (
            "Alcohol consumption is causally related to oral cavity, pharynx, larynx, oesophagus, "
            "liver, colorectal, and breast cancers. The risk increases with amount consumed and "
            "there is no safe threshold. Acetaldehyde, a metabolite of ethanol, is the primary "
            "carcinogen."
        ),
        "metadata": {"source": "WHO IARC", "year": 2019, "topic": "alcohol"},
    },
    {
        "id": "mediterranean_diet",
        "content": (
            "Adherence to a Mediterranean diet (high in olive oil, legumes, whole grains, "
            "vegetables, fruits, fish; moderate in wine; low in red/processed meat and dairy) "
            "is associated with a 10–15% reduction in overall cancer risk according to several "
            "meta-analyses."
        ),
        "metadata": {"source": "Annals of Oncology Meta-analysis", "year": 2021, "topic": "nutrition"},
    },
    {
        "id": "skin_cancer_uv",
        "content": (
            "Ultraviolet (UV) radiation from the sun and tanning devices is the main cause of "
            "skin cancer, including melanoma. Sun-protective measures (SPF 30+ sunscreen, "
            "protective clothing, shade) significantly reduce skin cancer risk."
        ),
        "metadata": {"source": "Cancer Research UK / WCRF", "year": 2022, "topic": "skin_cancer"},
    },
    {
        "id": "colorectal_fibre",
        "content": (
            "Higher dietary fibre intake, particularly from whole grains, is strongly associated "
            "with decreased colorectal cancer risk. Each 10 g/day increase in dietary fibre is "
            "associated with a 10% reduction in colorectal cancer risk (meta-analysis, BMJ 2011)."
        ),
        "metadata": {"source": "BMJ Meta-analysis", "year": 2011, "topic": "colorectal"},
    },
]


class RAGService:
    """Minimal RAG service; upgrades to a full ChromaDB-backed store in production."""

    def __init__(self):
        self._collection = None
        self._use_chroma = False
        self._try_init_chroma()

    def _try_init_chroma(self):
        try:
            import chromadb
            from chromadb.utils import embedding_functions

            os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
            client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
            ef = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=settings.EMBEDDING_MODEL
            )
            self._collection = client.get_or_create_collection(
                "cancer_research",
                embedding_function=ef,
            )
            # Seed with bundled documents if collection is empty
            if self._collection.count() == 0:
                self._seed_collection()
            self._use_chroma = True
            logger.info("ChromaDB initialised with %d documents", self._collection.count())
        except Exception as exc:
            logger.warning(
                "ChromaDB not available (%s); using keyword-based fallback retrieval", exc
            )

    def _seed_collection(self):
        docs = [d["content"] for d in SEED_DOCUMENTS]
        ids = [d["id"] for d in SEED_DOCUMENTS]
        metas = [d["metadata"] for d in SEED_DOCUMENTS]
        self._collection.add(documents=docs, ids=ids, metadatas=metas)

    def retrieve(self, query: str, n_results: int = 3) -> list[str]:
        """Retrieve relevant research snippets for a given query."""
        if self._use_chroma and self._collection:
            try:
                results = self._collection.query(
                    query_texts=[query],
                    n_results=min(n_results, self._collection.count()),
                )
                return results["documents"][0]
            except Exception as exc:
                logger.warning("ChromaDB query failed: %s", exc)

        # Keyword fallback
        query_lower = query.lower()
        scored = []
        for doc in SEED_DOCUMENTS:
            score = sum(
                1 for word in query_lower.split()
                if word in doc["content"].lower() or word in str(doc["metadata"]).lower()
            )
            scored.append((score, doc["content"]))
        scored.sort(reverse=True)
        return [content for _, content in scored[:n_results] if _ > 0]

    def add_document(self, doc_id: str, content: str, metadata: dict | None = None):
        """Add a new research document to the vector store."""
        if self._use_chroma and self._collection:
            self._collection.add(
                documents=[content],
                ids=[doc_id],
                metadatas=[metadata or {}],
            )
        SEED_DOCUMENTS.append({
            "id": doc_id,
            "content": content,
            "metadata": metadata or {},
        })


# Singleton instance
rag_service = RAGService()
