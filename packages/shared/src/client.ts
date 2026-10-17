import { readSse } from "./sse";
import type {
  AdminSource,
  Appeal,
  AppealQueueItem,
  AppealResult,
  BlockedMember,
  CommunityStats,
  InsightReviewItem,
  InsightReviewState,
  ModeratedPost,
  SurveyAnswer,
  SurveyStatus,
  SyncBlob,
  SyncMeta,
  TransparencyReport,
  CommunityMeta,
  FeedQuery,
  Member,
  MemberCreate,
  MemberMe,
  MemberUpdate,
  Post,
  PostKind,
  PostPage,
  PostResult,
  PostThread,
  QueueItem,
  ReactionKind,
  ReactionResult,
  ReportReason,
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

export class StepwellClient {
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

  // ── community (member token sent as X-Member-Token; optional country for local crisis lines) ──────
  readonly community = {
    meta: (lang?: string, signal?: AbortSignal) => this.request<CommunityMeta>("GET", `/community/meta${qs({ lang })}`, undefined, { signal }),
    join: (body: MemberCreate) => this.request<{ member: Member; token: string }>("POST", "/community/members", body),
    me: (token: string, signal?: AbortSignal) => this.request<MemberMe>("GET", "/community/members/me", undefined, { signal, headers: member(token) }),
    markSeen: (token: string) => this.request<void>("POST", "/community/members/me/seen", undefined, { headers: member(token) }),
    updateMe: (token: string, body: MemberUpdate) => this.request<Member>("PATCH", "/community/members/me", body, { headers: member(token) }),
    exportMe: (token: string) => this.request<Record<string, unknown>>("GET", "/community/members/me/export", undefined, { headers: member(token) }),
    eraseMe: (token: string) => this.request<void>("DELETE", "/community/members/me", undefined, { headers: member(token) }),
    feed: (token: string, query: FeedQuery = {}, signal?: AbortSignal) =>
      this.request<PostPage>("GET", `/community/posts${qs({ ...query })}`, undefined, { signal, headers: member(token) }),
    thread: (token: string, id: string, signal?: AbortSignal) =>
      this.request<PostThread>("GET", `/community/posts/${encodeURIComponent(id)}`, undefined, { signal, headers: member(token) }),
    post: (token: string, body: { circle: string; kind: PostKind; body: string; language?: string }, country?: string | null) =>
      this.request<PostResult>("POST", "/community/posts", body, { headers: member(token, country) }),
    reply: (token: string, id: string, body: { body: string; language?: string }, country?: string | null) =>
      this.request<PostResult>("POST", `/community/posts/${encodeURIComponent(id)}/replies`, body, { headers: member(token, country) }),
    edit: (token: string, id: string, text: string, country?: string | null) =>
      this.request<PostResult>("PATCH", `/community/posts/${encodeURIComponent(id)}`, { body: text }, { headers: member(token, country) }),
    remove: (token: string, id: string) => this.request<void>("DELETE", `/community/posts/${encodeURIComponent(id)}`, undefined, { headers: member(token) }),
    react: (token: string, id: string, kind: ReactionKind, on: boolean) =>
      this.request<ReactionResult>(on ? "PUT" : "DELETE", `/community/posts/${encodeURIComponent(id)}/reactions/${kind}`, undefined, { headers: member(token) }),
    blockAuthor: (token: string, postId: string) =>
      this.request<BlockedMember>("POST", `/community/posts/${encodeURIComponent(postId)}/block-author`, undefined, { headers: member(token) }),
    blocks: (token: string) => this.request<BlockedMember[]>("GET", "/community/members/me/blocks", undefined, { headers: member(token) }),
    unblock: (token: string, blockId: string) =>
      this.request<void>("DELETE", `/community/members/me/blocks/${encodeURIComponent(blockId)}`, undefined, { headers: member(token) }),
    report: (token: string, id: string, reason: ReportReason, note?: string) =>
      this.request<{ ok: boolean }>("POST", `/community/posts/${encodeURIComponent(id)}/reports`, { reason, note }, { headers: member(token) }),
    /** The member's own held or removed posts, with the reason and any appeal. */
    myModeration: (token: string, signal?: AbortSignal) =>
      this.request<ModeratedPost[]>("GET", "/community/members/me/moderation", undefined, { signal, headers: member(token) }),
    appeal: (token: string, postId: string, text: string, country?: string | null) =>
      this.request<AppealResult>("POST", `/community/posts/${encodeURIComponent(postId)}/appeal`, { text }, { headers: member(token, country) }),
    survey: (token: string, signal?: AbortSignal) =>
      this.request<SurveyStatus>("GET", "/community/survey", undefined, { signal, headers: member(token) }),
    answerSurvey: (token: string, answer: SurveyAnswer) =>
      this.request<SurveyStatus>("POST", "/community/survey", { answer }, { headers: member(token) }),
  };

  /** Public quarterly community moderation report (aggregates only). */
  transparency(quarter?: string, signal?: AbortSignal) {
    return this.request<TransparencyReport>("GET", `/transparency${qs({ quarter })}`, undefined, { signal });
  }

  // ── end-to-end-encrypted device sync (ciphertext only; see sync.ts) ─────────
  readonly sync = {
    meta: (signal?: AbortSignal) => this.request<SyncMeta>("GET", "/sync", undefined, { signal }),
    /** Resolves null when nothing is stored for this id (or the secret does not match). */
    get: async (id: string, auth: string, signal?: AbortSignal): Promise<SyncBlob | null> => {
      try {
        return await this.request<SyncBlob>("GET", `/sync/${encodeURIComponent(id)}`, undefined, { signal, headers: bearer(auth) });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    put: (id: string, auth: string, ciphertext: string, version: number) =>
      this.request<SyncBlob>("PUT", `/sync/${encodeURIComponent(id)}`, { ciphertext, version }, { headers: bearer(auth) }),
    remove: (id: string, auth: string) => this.request<void>("DELETE", `/sync/${encodeURIComponent(id)}`, undefined, { headers: bearer(auth) }),
  };

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
    communityQueue: (limit = 100) => this.request<QueueItem[]>("GET", `/admin/community/queue${qs({ limit })}`, undefined, { admin: true }),
    moderate: (id: string, action: "approve" | "remove", note?: string) =>
      this.request<Post>("POST", `/admin/community/posts/${encodeURIComponent(id)}/moderate`, { action, note }, { admin: true }),
    memberStatus: (id: string, status: "active" | "suspended" | "banned") =>
      this.request<Member>("POST", `/admin/community/members/${encodeURIComponent(id)}/status`, { status }, { admin: true }),
    communityStats: () => this.request<CommunityStats>("GET", "/admin/community/stats", undefined, { admin: true }),
    appeals: (status: Appeal["status"] = "open", limit = 100) =>
      this.request<AppealQueueItem[]>("GET", `/admin/community/appeals${qs({ status, limit })}`, undefined, { admin: true }),
    decideAppeal: (id: string, action: "uphold" | "overturn", response?: string) =>
      this.request<Appeal>("POST", `/admin/community/appeals/${encodeURIComponent(id)}`, { action, response }, { admin: true }),
    insightReviews: (state: InsightReviewState = "pending") =>
      this.request<InsightReviewItem[]>("GET", `/admin/insights/review${qs({ state })}`, undefined, { admin: true }),
    reviewInsight: (id: string, decision: "approved" | "rejected", reviewer: string, note?: string) =>
      this.request<{ id: string; decision: string; version: number; status: string }>(
        "POST", `/admin/insights/${encodeURIComponent(id)}/review`, { decision, reviewer, note }, { admin: true }),
  };
}

function bearer(auth: string): Record<string, string> {
  return { Authorization: `Bearer ${auth}` };
}

function member(token: string, country?: string | null): Record<string, string> {
  const headers: Record<string, string> = { "X-Member-Token": token };
  if (country) headers["X-Country"] = country;
  return headers;
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
