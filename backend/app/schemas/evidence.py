"""Evidence contract: every answer and every insight carries these objects so users can audit claims."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SourceRef(BaseModel):
    document_id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    journal: str | None = None
    publisher: str | None = None
    doi: str | None = None
    pmid: str | None = None
    url: str | None = None
    source_type: str = "unknown"
    source_type_label: str = "Unclassified"
    credibility: str = "unverified"
    credibility_label: str = "Unverified"
    quality_score: float = 0.0
    language: str = "en"
    license: str | None = None

    @property
    def link(self) -> str | None:
        if self.doi:
            return f"https://doi.org/{self.doi}"
        if self.pmid:
            return f"https://pubmed.ncbi.nlm.nih.gov/{self.pmid}/"
        return self.url


class EvidenceChunk(BaseModel):
    """A retrieved passage offered to the generator, numbered for citation ([n])."""

    n: int
    chunk_id: str
    source: SourceRef
    text: str
    section: str | None = None
    page_start: int | None = None
    page_end: int | None = None
    relevance: float = 0.0
    score: float = 0.0


class Citation(BaseModel):
    n: int
    chunk_id: str
    source: SourceRef
    quote: str = Field(description="Best-supporting sentence(s) from the passage")
    quote_start: int = 0
    quote_end: int = 0
    passage: str = Field(default="", description="Full retrieved passage (for 'show context')")
    section: str | None = None
    page_start: int | None = None
    page_end: int | None = None
    relevance: float = 0.0
    support: float | None = None
    support_label: Literal["strong", "partial", "weak", "not_assessed"] = "not_assessed"


SupportLabel = Literal["supported", "partial", "unsupported", "no_citation", "not_claim", "not_assessed"]


class ClaimCheck(BaseModel):
    sentence: str
    start: int
    end: int
    citations: list[int] = Field(default_factory=list)
    support: float | None = None
    label: SupportLabel = "not_assessed"
    best_citation: int | None = None
    issues: list[str] = Field(default_factory=list)


class Verification(BaseModel):
    claims: list[ClaimCheck] = Field(default_factory=list)
    grounded_ratio: float = Field(0.0, description="Share of factual sentences supported by their citations")
    citation_precision: float = 0.0
    unsupported: int = 0
    method: str = "lexical"


class RationaleItem(BaseModel):
    code: str
    text: str
    params: dict = Field(default_factory=dict)


class EvidenceAssessment(BaseModel):
    level: Literal["high", "moderate", "low", "very_low", "insufficient"]
    grade: str
    label: str
    score: float
    description: str
    rationale: list[RationaleItem] = Field(default_factory=list)
    n_sources: int = 0
    design_breakdown: dict[str, int] = Field(default_factory=dict)
    credibility_breakdown: dict[str, int] = Field(default_factory=dict)
    year_range: list[int] | None = None
    languages: list[str] = Field(default_factory=list)
    consistency: Literal["consistent", "mixed", "not_assessed"] = "not_assessed"
    caps_applied: list[str] = Field(default_factory=list)
    strongest_source: SourceRef | None = None
