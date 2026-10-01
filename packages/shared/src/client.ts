import { readSse } from "./sse";
import type {
  AdminSource,
  ApiErrorBody,
  ChatEvent,
  ChatRequest,
  ChatResponse,
  Chunk,
  DocumentDetail,
  DocumentList,
  DocumentQuery,
  DocumentSummary,
  FeedbackCreate,
  Insight,
  InsightList,
  InsightQuery,
  Job,
  Meta,
  PlatformStatus,
  SearchRequest,
  SearchResponse,
  SourceCreate,
  TopicStatus,
} from "./types";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  /** Base URL of the API ("" = same origin). The client appends /api/v1/... */
  baseUrl: string;
  fetch?: FetchLike;
  /** Admin key provider (sent as X-Admin-Key on admin calls only). */
  adminKey?: () => string | null | undefined;
  /** Default request timeout for non-streaming calls. */
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId?: string | null,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(params?: Query): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export class VitaCiteClient {
  private readonly base: string;
  private readonly fetcher: FetchLike;

  constructor(private readonly options: ClientOptions) {
    this.base = options.baseUrl.replace(/\/+$/, "") + "/api/v1";
    const f = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!f) throw new Error("No fetch implementation available");
    this.fetcher = (input, init) => f(input, init);
  }

  // ── transport ─────────────────────────────────────────────────────────────
  private async request<T>(method: string, path: string, body?: unknown, opts: { admin?: boolean; signal?: AbortSignal; headers?: Record<string, string> } = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.admin) {
      const key = this.options.adminKey?.();
      if (key) headers["X-Admin-Key"] = key;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 30_000);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onAbort);
    try {
      const response = await this.fetcher(this.base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 204) return undefined as T;
      if (!response.ok) throw await toApiError(response);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }

  // ── public ────────────────────────────────────────────────────────────────
  status(signal?: AbortSignal) {
    return this.request<PlatformStatus>("GET", "/status", undefined, { signal });
  }

  meta(signal?: AbortSignal) {
    return this.request<Meta>("GET", "/meta", undefined, { signal });
  }

  insights(query: InsightQuery = {}, signal?: AbortSignal) {
    return this.request<InsightList>("GET", `/insights${qs(query as Query)}`, undefined, { signal });
  }

  insight(id: string, signal?: AbortSignal) {
    return this.request<Insight>("GET", `/insights/${encodeURIComponent(id)}`, undefined, { signal });
  }

  topics(lang?: string, signal?: AbortSignal) {
    return this.request<TopicStatus[]>("GET", `/topics${qs({ lang })}`, undefined, { signal });
  }

  documents(query: DocumentQuery = {}, signal?: AbortSignal) {
    return this.request<DocumentList>("GET", `/documents${qs(query as Query)}`, undefined, { signal });
  }

  document(id: string, lang?: string, signal?: AbortSignal) {
    return this.request<DocumentDetail>("GET", `/documents/${encodeURIComponent(id)}${qs({ lang })}`, undefined, { signal });
  }

  chunk(id: string, signal?: AbortSignal) {
    return this.request<{ chunk: Chunk; document: DocumentSummary }>("GET", `/chunks/${encodeURIComponent(id)}`, undefined, { signal });
  }

  search(body: SearchRequest, signal?: AbortSignal) {
    return this.request<SearchResponse>("POST", "/search", body, { signal });
  }

  feedback(body: FeedbackCreate) {
    return this.request<{ ok: boolean }>("POST", "/feedback", body);
  }

  /** Non-streaming chat (also the fallback for clients without streaming support). */
  chat(body: ChatRequest, signal?: AbortSignal) {
    return this.request<ChatResponse>("POST", "/chat", { ...body, stream: false }, { signal });
  }

  /**
   * Streaming chat. Calls `onEvent` for every event as it arrives and resolves with the final response.
   * Works with browser fetch and expo/fetch (both expose ReadableStream bodies).
   */
  async chatStream(body: ChatRequest, onEvent: (event: ChatEvent) => void, signal?: AbortSignal): Promise<ChatResponse> {
    const response = await this.fetcher(this.base + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });
    if (!response.ok) throw await toApiError(response);
    let final: ChatResponse | null = null;
    for await (const raw of readSse(response, signal)) {
      let data: unknown = {};
      try {
        data = raw.data ? JSON.parse(raw.data) : {};
      } catch {
        continue; // ignore malformed frames rather than breaking the conversation
      }
      const event = { type: raw.event, data } as ChatEvent;
      onEvent(event);
      if (event.type === "final") final = event.data;
      if (event.type === "error" && !final) throw new ApiError(event.data.message, 500);
    }
    if (!final) throw new ApiError("The answer stream ended unexpectedly.", 502);
    return final;
  }

  // ── admin ─────────────────────────────────────────────────────────────────
  readonly admin = {
    sources: () => this.request<AdminSource[]>("GET", "/admin/sources", undefined, { admin: true }),
    createSource: (body: SourceCreate) => this.request<AdminSource>("POST", "/admin/sources", body, { admin: true }),
    updateSource: (id: string, body: Partial<SourceCreate>) =>
      this.request<AdminSource>("PATCH", `/admin/sources/${encodeURIComponent(id)}`, body, { admin: true }),
    deleteSource: (id: string) => this.request<void>("DELETE", `/admin/sources/${encodeURIComponent(id)}`, undefined, { admin: true }),
    testSource: (id: string) =>
      this.request<{ ok: boolean; sample?: { path: string; size: number }[]; error?: string }>(
        "POST", `/admin/sources/${encodeURIComponent(id)}/test`, undefined, { admin: true }),
    ingest: (body: { source_ids?: string[] | null; mode?: "incremental" | "full" } = {}) =>
      this.request<Job>("POST", "/admin/ingest", body, { admin: true }),
    rebuildInsights: (body: { topic_ids?: string[] | null; languages?: string[] | null; force?: boolean } = {}) =>
      this.request<Job>("POST", "/admin/insights/rebuild", body, { admin: true }),
    evaluate: (body: { dataset?: string | null; k?: number } = {}) => this.request<Job>("POST", "/admin/evaluate", body, { admin: true }),
    exportSft: (body: { languages?: string[] | null; max_examples?: number; distractors?: number } = {}) =>
      this.request<Job>("POST", "/admin/export/sft", body, { admin: true }),
    jobs: (limit = 30) => this.request<Job[]>("GET", `/admin/jobs${qs({ limit })}`, undefined, { admin: true }),
    job: (id: string) => this.request<Job>("GET", `/admin/jobs/${encodeURIComponent(id)}`, undefined, { admin: true }),
    cancelJob: (id: string) => this.request<Job>("POST", `/admin/jobs/${encodeURIComponent(id)}/cancel`, undefined, { admin: true }),
    stats: () => this.request<Record<string, unknown>>("GET", "/admin/stats", undefined, { admin: true }),
  };
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = `${response.status} ${response.statusText}`;
  let requestId: string | null = response.headers.get("x-request-id");
  let details: unknown;
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (body.error) {
      message = typeof body.error.message === "string" ? body.error.message : message;
      requestId = body.error.request_id ?? requestId;
      details = body.error.details;
    }
  } catch {
    // non-JSON error body
  }
  return new ApiError(message, response.status, requestId, details);
}
