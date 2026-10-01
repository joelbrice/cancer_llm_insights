"use client";

import {
  ApiError,
  DICTIONARIES,
  formatDate,
  formatNumber,
  sortedDesigns,
  translateDynamic,
  type AdminSource,
  type Job,
  type PlatformStatus,
} from "@vitacite/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { ADMIN_KEY_STORAGE, browserApi } from "@/lib/browser-api";
import { useLocale, useT } from "@/lib/i18n-client";
import { readSession, writeSession } from "@/lib/storage";

import { HBarChart, StatTile } from "./charts";
import { Icon } from "./Icon";

const KIND_LABEL: Record<string, string> = { local: "Local", s3: "S3", gcs: "GCS", azure: "Azure", http: "HTTP", memory: "Memory" };
const ACTIVE = new Set(["queued", "running", "cancel_requested"]);

export function AdminConsole() {
  const t = useT();
  const lang = useLocale();
  const api = browserApi();
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [sources, setSources] = useState<AdminSource[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.status());
    } catch {
      setError(t("common.apiUnreachable"));
      return;
    }
    try {
      const [s, j, st] = await Promise.all([api.admin.sources(), api.admin.jobs(25), api.admin.stats()]);
      setSources(s);
      setJobs(j);
      setStats(st);
      setUnlocked(true);
      setError(null);
    } catch (err) {
      setUnlocked(false);
      if (!(err instanceof ApiError && err.isUnauthorized)) setError(err instanceof Error ? err.message : t("common.error"));
    }
  }, [api, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const anyActive = jobs.some((j) => ACTIVE.has(j.status)) || Boolean(status?.active_job);
  useEffect(() => {
    const id = setInterval(() => void refresh(), anyActive ? 2000 : 15000);
    return () => clearInterval(id);
  }, [anyActive, refresh]);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    setNotice(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const designs = sortedDesigns((stats?.documents_by_type as Record<string, number>) ?? {}).map((d) => ({
    id: d.id,
    label: translateDynamic(t, "designs", d.id),
    value: d.count,
  }));

  return (
    <div className="space-y-8">
      {status && !status.admin_protected ? (
        <p className="flex items-start gap-2 rounded-xl border border-warning bg-warning-soft p-3 text-sm text-ink" role="note">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warning-ink" />
          {t("admin.openWarning")}
        </p>
      ) : null}

      {status?.admin_protected && !unlocked ? (
        <form
          className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            writeSession(ADMIN_KEY_STORAGE, keyInput.trim() || null);
            setKeyInput("");
            void refresh();
          }}
        >
          <div className="flex-1">
            <label className="label" htmlFor="admin-key">
              {t("admin.keyLabel")}
            </label>
            <input id="admin-key" type="password" autoComplete="off" className="field" placeholder={t("admin.keyPlaceholder")} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">
            <Icon name="lock" size={18} />
            {t("admin.unlock")}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="flex items-center gap-2 rounded-xl border border-critical bg-critical-soft p-3 text-sm text-ink" role="alert">
          <Icon name="octagon" size={18} className="text-critical" />
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl bg-info-soft p-3 text-sm text-ink" role="status">
          {notice}
        </p>
      ) : null}

      {status ? (
        <section aria-labelledby="overview" className="space-y-4">
          <h2 id="overview" className="text-lg font-semibold">
            {t("admin.overview")}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label={t("admin.documents")} value={formatNumber(lang, status.documents)} />
            <StatTile label={t("admin.passages")} value={formatNumber(lang, status.chunks)} />
            <StatTile label={t("admin.insights")} value={formatNumber(lang, status.insights)} />
            <StatTile label={t("admin.sources")} value={String(status.sources.length)} detail={t("admin.autoSync", { minutes: Math.round(status.sync_interval_seconds / 60) })} />
          </div>
          <div className="card grid gap-3 p-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-ink-2">{t("admin.llm")}</p>
              <p className="font-semibold">
                {status.llm.model} <span className="font-normal text-ink-3">({status.llm.provider})</span>
              </p>
              <p className="text-xs text-ink-3">{status.llm.available === false ? "⚠︎ unreachable" : "✓"}</p>
            </div>
            <div>
              <p className="text-ink-2">{t("admin.embeddings")}</p>
              <p className="font-semibold">{status.embeddings.model}</p>
              <p className="text-xs text-ink-3">
                {status.embeddings.provider} · {status.embeddings.dim}d{status.embeddings.multilingual ? " · multilingual" : ""}
              </p>
            </div>
            <div>
              <p className="text-ink-2">{t("admin.vectorStore")}</p>
              <p className="font-semibold">{status.vector_store.backend}</p>
              <p className="text-xs text-ink-3">
                {formatNumber(lang, status.vector_store.vectors)} vectors · {status.vector_store.healthy ? "healthy" : "unhealthy"}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {unlocked ? (
        <>
          <section aria-labelledby="actions" className="space-y-3">
            <h2 id="actions" className="sr-only">
              Actions
            </h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => void run("sync", () => api.admin.ingest({ mode: "incremental" }))}>
                <Icon name="refresh" size={18} />
                {t("admin.syncNow")}
              </button>
              <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => void run("full", () => api.admin.ingest({ mode: "full" }))}>
                {t("admin.fullResync")}
              </button>
              <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => void run("rebuild", () => api.admin.rebuildInsights({ force: true }))}>
                <Icon name="spark" size={18} />
                {t("admin.rebuild")}
              </button>
              <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => void run("eval", () => api.admin.evaluate({}))}>
                <Icon name="clipboard" size={18} />
                {t("admin.evaluate")}
              </button>
              <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => void run("sft", () => api.admin.exportSft({}))}>
                <Icon name="file" size={18} />
                {t("admin.exportSft")}
              </button>
            </div>
          </section>

          <section aria-labelledby="sources" className="space-y-3">
            <h2 id="sources" className="text-lg font-semibold">
              {t("admin.sources")}
            </h2>
            <ul className="space-y-3">
              {sources.map((source) => {
                const st = status?.sources.find((s) => s.id === source.id);
                return (
                  <li key={source.id} className="card p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          <span className="chip !font-semibold">{KIND_LABEL[source.kind] ?? source.kind}</span>
                          {source.name}
                          <span className="text-xs font-normal text-ink-3">({source.id} · {source.origin})</span>
                        </p>
                        <p className="mt-1 break-all font-mono text-xs text-ink-2">{source.uri}</p>
                        <p className="mt-1 text-xs text-ink-3">
                          {st?.last_synced_at ? t("admin.lastSync", { date: formatDate(lang, st.last_synced_at) }) : t("admin.neverSynced")}
                          {st ? ` · ${formatNumber(lang, st.documents)} ${t("admin.documents").toLowerCase()}` : ""}
                          {st?.last_status && st.last_status !== "never" ? ` · ${st.last_status}` : ""}
                        </p>
                        {st?.last_error ? <p className="mt-1 text-xs text-critical">{st.last_error}</p> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost !min-h-9 !px-3 text-sm"
                          disabled={!!busy}
                          onClick={() =>
                            void run(`test-${source.id}`, async () => {
                              const res = await api.admin.testSource(source.id);
                              setNotice(res.ok ? `${source.name}: ${t("admin.testOk", { n: res.sample?.length ?? 0 })}` : `${source.name}: ${res.error}`);
                            })
                          }
                        >
                          {t("admin.test")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost !min-h-9 !px-3 text-sm"
                          disabled={!!busy || !source.enabled}
                          onClick={() => void run(`sync-${source.id}`, () => api.admin.ingest({ source_ids: [source.id] }))}
                        >
                          {t("admin.syncNow")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost !min-h-9 !px-3 text-sm"
                          aria-pressed={source.enabled}
                          disabled={!!busy}
                          onClick={() => void run(`toggle-${source.id}`, () => api.admin.updateSource(source.id, { enabled: !source.enabled }))}
                        >
                          {source.enabled ? t("admin.enabled") : t("admin.disabled")}
                        </button>
                        {source.origin === "api" ? (
                          <button
                            type="button"
                            className="btn btn-ghost !min-h-9 !px-3 text-sm"
                            disabled={!!busy}
                            onClick={() => void run(`del-${source.id}`, () => api.admin.deleteSource(source.id))}
                            aria-label={`${t("common.delete")} ${source.name}`}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <AddSource onCreated={() => void refresh()} onError={setError} />
          </section>

          <section aria-labelledby="jobs" className="space-y-3">
            <h2 id="jobs" className="text-lg font-semibold">
              {t("admin.jobs")}
            </h2>
            {jobs.length === 0 ? <p className="text-ink-2">{t("admin.noJobs")}</p> : null}
            <ul className="space-y-2">
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} onCancel={() => void run(`cancel-${job.id}`, () => api.admin.cancelJob(job.id))} />
              ))}
            </ul>
          </section>

          {designs.length ? (
            <section className="card p-5">
              <HBarChart data={designs} title={t("admin.byDesign")} />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function JobRow({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const t = useT();
  const lang = useLocale();
  const active = ACTIVE.has(job.status);
  const tone = job.status === "failed" ? "text-critical" : job.status === "succeeded" ? "text-good-ink" : "text-ink-2";
  const summary = Object.entries(job.stats)
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .slice(0, 8)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {t(`admin.jobKinds.${job.kind}`)} <span className={`text-sm font-medium ${tone}`}>· {t(`admin.jobStatus.${job.status}`)}</span>
        </p>
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <span>
            {formatDate(lang, job.created_at)} · {job.triggered_by}
          </span>
          {active ? (
            <button type="button" className="btn btn-ghost !min-h-8 !px-3 text-xs" onClick={onCancel}>
              {t("admin.cancelJob")}
            </button>
          ) : null}
        </div>
      </div>
      {active ? (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(job.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round(job.progress * 100)}%` }} />
          </div>
          <p className="mt-1 truncate text-xs text-ink-2">{job.message}</p>
        </div>
      ) : null}
      {summary ? <p className="mt-2 break-words text-xs text-ink-2">{summary}</p> : null}
      {job.error ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-critical">{job.error.split("\n")[0]}</summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-ink-2">{job.error}</pre>
        </details>
      ) : null}
    </li>
  );
}

function AddSource({ onCreated, onError }: { onCreated: () => void; onError: (message: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", uri: "", source_type: "auto", credibility: "peer_reviewed", options: "" });
  const designs = ["auto", ...Object.keys(DICTIONARIES.en.designs).filter((d) => d !== "unknown")];
  const creds = Object.keys(DICTIONARIES.en.credibility);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <Icon name="plus" size={18} />
        {t("admin.addSource")}
      </button>
    );
  }
  return (
    <form
      className="card grid gap-4 p-5 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        let storage_options: Record<string, unknown> = {};
        if (form.options.trim()) {
          try {
            storage_options = JSON.parse(form.options) as Record<string, unknown>;
          } catch {
            onError(`${t("admin.storageOptions")}: JSON`);
            return;
          }
        }
        try {
          await browserApi().admin.createSource({
            id: form.id.trim(),
            name: form.name.trim(),
            uri: form.uri.trim(),
            storage_options,
            defaults: { source_type: form.source_type, credibility: form.credibility },
          });
          setOpen(false);
          setForm({ id: "", name: "", uri: "", source_type: "auto", credibility: "peer_reviewed", options: "" });
          onCreated();
        } catch (err) {
          onError(err instanceof Error ? err.message : t("common.error"));
        }
      }}
    >
      <h3 className="font-semibold md:col-span-2">{t("admin.addSource")}</h3>
      <div>
        <label className="label" htmlFor="s-id">
          {t("admin.sourceId")}
        </label>
        <input id="s-id" required pattern="[a-z0-9][a-z0-9_\-]{1,62}" className="field" value={form.id} onChange={set("id")} placeholder="s3-research" />
      </div>
      <div>
        <label className="label" htmlFor="s-name">
          {t("admin.sourceName")}
        </label>
        <input id="s-name" required className="field" value={form.name} onChange={set("name")} />
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="s-uri">
          {t("admin.sourceUri")}
        </label>
        <input id="s-uri" required className="field font-mono" value={form.uri} onChange={set("uri")} placeholder="s3://my-bucket/cancer-corpus/" aria-describedby="s-uri-help" />
        <p id="s-uri-help" className="mt-1 text-xs text-ink-3">
          {t("admin.uriHelp")}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="s-type">
          {t("admin.defaultType")}
        </label>
        <select id="s-type" className="field" value={form.source_type} onChange={set("source_type")}>
          {designs.map((d) => (
            <option key={d} value={d}>
              {d === "auto" ? "auto" : translateDynamic(t, "designs", d)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="s-cred">
          {t("admin.defaultCredibility")}
        </label>
        <select id="s-cred" className="field" value={form.credibility} onChange={set("credibility")}>
          {creds.map((c) => (
            <option key={c} value={c}>
              {translateDynamic(t, "credibility", c)}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="s-opts">
          {t("admin.storageOptions")}
        </label>
        <textarea
          id="s-opts"
          className="field min-h-24 font-mono text-sm"
          value={form.options}
          onChange={set("options")}
          placeholder={'{"key": "${AWS_ACCESS_KEY_ID}", "secret": "${AWS_SECRET_ACCESS_KEY}"}'}
          aria-describedby="s-opts-help"
        />
        <p id="s-opts-help" className="mt-1 text-xs text-ink-3">
          {t("admin.secretsHelp")}
        </p>
      </div>
      <div className="flex gap-2 md:col-span-2">
        <button type="submit" className="btn btn-primary">
          {t("admin.create")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
