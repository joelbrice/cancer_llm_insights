/**
 * API contract — mirrors backend/app/schemas/{api,evidence}.py and app/safety/guardrails.py.
 * Keep in sync when the backend schemas change (CI type-checks web and mobile against this file).
 */

export type Locale = "en" | "fr" | "es" | "pt" | "de";
export type EvidenceLevelId = "high" | "moderate" | "low" | "very_low" | "insufficient";
export type Audience = "prevention" | "living_with_cancer" | "caregivers";
export type SupportLabel = "supported" | "partial" | "unsupported" | "no_citation" | "not_claim" | "not_assessed";

// ── Evidence ──────────────────────────────────────────────────────────────────
export interface SourceRef {
  document_id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  publisher: string | null;
  doi: string | null;
  pmid: string | null;
  url: string | null;
  source_type: string;
  source_type_label: string;
  credibility: string;
  credibility_label: string;
  quality_score: number;
  language: string;
  license: string | null;
}

export interface EvidenceChunk {
  n: number;
  chunk_id: string;
  source: SourceRef;
  text: string;
  section: string | null;
  page_start: number | null;
  page_end: number | null;
  relevance: number;
  score: number;
}

export interface Citation {
  n: number;
  chunk_id: string;
  source: SourceRef;
  quote: string;
  quote_start: number;
  quote_end: number;
  passage: string;
  section: string | null;
  page_start: number | null;
  page_end: number | null;
  relevance: number;
  support: number | null;
  support_label: "strong" | "partial" | "weak" | "not_assessed";
}

export interface ClaimCheck {
  sentence: string;
  start: number;
  end: number;
  citations: number[];
  support: number | null;
  label: SupportLabel;
  best_citation: number | null;
  issues: string[];
}

export interface Verification {
  claims: ClaimCheck[];
  grounded_ratio: number;
  citation_precision: number;
  unsupported: number;
  method: string;
}

export interface RationaleItem {
  code: string;
  text: string;
  params: Record<string, unknown>;
}

export interface EvidenceAssessment {
  level: EvidenceLevelId;
  grade: string;
  label: string;
  score: number;
  description: string;
  rationale: RationaleItem[];
  n_sources: number;
  design_breakdown: Record<string, number>;
  credibility_breakdown: Record<string, number>;
  year_range: [number, number] | null;
  languages: string[];
  consistency: "consistent" | "mixed" | "not_assessed";
  caps_applied: string[];
  strongest_source: SourceRef | null;
}

// ── Safety ────────────────────────────────────────────────────────────────────
export interface SafetyNotice {
  rule: string;
  level: "caution" | "urgent" | "emergency";
  message: string;
}

export interface CrisisResource {
  name: string;
  contact: string;
}

export interface SafetyAssessment {
  level: "none" | "caution" | "urgent" | "emergency";
  flags: string[];
  block_generation: boolean;
  notices: SafetyNotice[];
  resources: CrisisResource[];
  prompt_injection: boolean;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Profile {
  audience?: Audience | null;
  age_range?: "<30" | "30-39" | "40-49" | "50-59" | "60-69" | "70+" | null;
  sex?: "female" | "male" | "intersex" | "prefer_not_to_say" | null;
  cancer_types?: string[];
  treatment_phase?: "pre_treatment" | "in_treatment" | "post_treatment" | "advanced" | "survivorship" | null;
  goals?: string[];
  country?: string | null;
}

export interface EvidenceFilters {
  source_types?: string[] | null;
  min_year?: number | null;
  languages?: string[] | null;
  cancer_types?: string[] | null;
  min_quality?: number | null;
}

export interface ChatRequest {
  messages: ChatMessage[];
  language?: string | null;
  ui_language?: string | null;
  profile?: Profile | null;
  filters?: EvidenceFilters | null;
  stream?: boolean;
}

export interface RelatedInsight {
  id: string;
  title: string;
  category: string;
  evidence_level: EvidenceLevelId;
}

export interface ChatResponse {
  id: string;
  answer: string;
  language: string;
  abstained: boolean;
  abstain_reason: "safety" | "awaiting_data" | "insufficient_evidence" | null;
  citations: Citation[];
  evidence: EvidenceAssessment | null;
  verification: Verification | null;
  safety: SafetyAssessment;
  output_flags: string[];
  related_insights: RelatedInsight[];
  disclaimer: string;
  model: string;
  timings_ms: Record<string, number>;
  retrieved: number;
}

export type ChatEvent =
  | { type: "meta"; data: { id: string; language: string; model: string; safety: SafetyAssessment } }
  | { type: "evidence"; data: { evidence: EvidenceChunk[]; trace: Record<string, unknown> } }
  | { type: "delta"; data: { text: string } }
  | { type: "final"; data: ChatResponse }
  | { type: "error"; data: { code: string; message: string } }
  | { type: "done"; data: Record<string, never> };

// ── Search ────────────────────────────────────────────────────────────────────
export interface SearchRequest {
  query: string;
  language?: string | null;
  top_k?: number;
  filters?: EvidenceFilters | null;
}

export interface SearchResponse {
  query: string;
  language: string;
  results: Citation[];
  evidence: EvidenceAssessment;
  took_ms: number;
}

// ── Insights ──────────────────────────────────────────────────────────────────
export interface InsightPoint {
  text: string;
  citations: number[];
  support: number | null;
  label: SupportLabel;
}

export interface InsightSummary {
  id: string;
  topic_id: string;
  language: string;
  category: string;
  audience: Audience[];
  cancer_types: string[];
  title: string;
  question: string;
  summary: string;
  evidence_level: EvidenceLevelId;
  evidence_grade: string;
  evidence_score: number;
  n_sources: number;
  status: "published" | "insufficient_evidence" | "needs_review";
  updated_at: string;
}

export interface Insight extends InsightSummary {
  key_points: InsightPoint[];
  recommendations: InsightPoint[];
  limitations: string[];
  citations: Citation[];
  evidence: EvidenceAssessment;
  model: string;
  prompt_version: string;
  version: number;
  generated_at: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type InsightList = Paged<InsightSummary>;

export interface TopicStatus {
  id: string;
  category: string;
  audience: Audience[];
  title: string;
  question: string;
  status: "published" | "insufficient_evidence" | "pending" | "needs_review";
  evidence_level: EvidenceLevelId | null;
  insight_id: string | null;
}

export interface InsightQuery {
  lang?: string;
  category?: string;
  audience?: Audience;
  min_level?: Exclude<EvidenceLevelId, "insufficient">;
  q?: string;
  cancer_type?: string;
  page?: number;
  page_size?: number;
}

// ── Documents ─────────────────────────────────────────────────────────────────
export interface DocumentSummary {
  id: string;
  source_id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  publisher: string | null;
  doi: string | null;
  pmid: string | null;
  url: string | null;
  language: string;
  source_type: string;
  source_type_label: string;
  source_type_basis: string | null;
  source_type_confidence: number;
  credibility: string;
  quality_score: number;
  n_chunks: number;
  status: string;
  retracted: boolean;
  license: string | null;
  indexed_at: string | null;
}

export interface Chunk {
  id: string;
  ordinal: number;
  text: string;
  section: string | null;
  page_start: number | null;
  page_end: number | null;
}

export interface DocumentDetail extends DocumentSummary {
  abstract: string | null;
  topics: string[];
  cancer_types: string[];
  error: string | null;
  chunks: Chunk[];
  cited_by: RelatedInsight[];
  source: SourceRef;
}

export interface DocumentList extends Paged<DocumentSummary> {
  facets: Record<string, Record<string, number>>;
}

export interface DocumentQuery {
  q?: string;
  source_type?: string;
  language?: string;
  min_year?: number;
  sort?: "quality" | "year" | "title";
  page?: number;
  page_size?: number;
}

// ── Platform ──────────────────────────────────────────────────────────────────
export type DataStatus = "awaiting_data" | "indexing" | "ready" | "degraded";

export interface SourceStatus {
  id: string;
  name: string;
  kind: string;
  uri: string;
  enabled: boolean;
  origin: string;
  last_synced_at: string | null;
  last_status: string;
  last_error: string | null;
  documents: number;
}

export interface PlatformStatus {
  app: string;
  version: string;
  environment: string;
  data_status: DataStatus;
  documents: number;
  chunks: number;
  insights: number;
  index_version: number;
  sources: SourceStatus[];
  llm: { provider: string; model: string; available: boolean | null; grounding: string };
  embeddings: { provider: string; model: string; dim: number; multilingual: boolean };
  vector_store: { backend: string; healthy: boolean; vectors: number };
  languages: string[];
  active_job: { id: string; kind: string; status: string; progress: number; message: string | null } | null;
  admin_protected: boolean;
  sync_interval_seconds: number;
}

export interface Meta {
  app: string;
  languages: string[];
  default_language: string;
  evidence_levels: { id: EvidenceLevelId; grade: string; label: string; min_score: number; description: string }[];
  study_designs: { id: string; label: string; weight: number; tier: number; human_evidence: boolean; description: string }[];
  credibility_tiers: { id: string; multiplier: number; label: string; description: string }[];
  categories: { id: string; label: string }[];
  audiences: { id: Audience; label: string }[];
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export interface AdminSource {
  id: string;
  name: string;
  uri: string;
  kind: string;
  enabled: boolean;
  origin: string;
  include: string[];
  exclude: string[];
  storage_options: Record<string, unknown>;
  defaults: Record<string, unknown>;
}

export interface SourceCreate {
  id: string;
  name: string;
  uri: string;
  enabled?: boolean;
  include?: string[] | null;
  exclude?: string[] | null;
  storage_options?: Record<string, unknown>;
  defaults?: Record<string, unknown>;
}

export interface Job {
  id: string;
  kind: "ingest" | "insights" | "evaluate" | "export_sft";
  status: "queued" | "running" | "cancel_requested" | "succeeded" | "failed" | "cancelled";
  triggered_by: string;
  params: Record<string, unknown>;
  progress: number;
  message: string | null;
  stats: Record<string, unknown>;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface FeedbackCreate {
  target_type: "answer" | "insight" | "citation";
  target_id: string;
  rating: 1 | -1;
  reasons?: ("inaccurate" | "not_supported" | "unclear" | "unsafe" | "outdated" | "helpful" | "other")[];
  comment?: string | null;
  language?: string | null;
}

export interface ApiErrorBody {
  error: { code: number; message: string; request_id?: string | null; details?: unknown };
}
