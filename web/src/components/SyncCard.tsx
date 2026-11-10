"use client";

import {
  deleteRemoteCopy,
  formatDate,
  generateSyncCode,
  normalizeSyncCode,
  STORAGE_KEYS,
  type SyncState,
} from "@stepwell/shared";
import { useEffect, useState, type FormEvent } from "react";

import { browserApi } from "@/lib/browser-api";
import { useLocale, useT } from "@/lib/i18n-client";
import { removeLocal, useLocalState, writeLocal } from "@/lib/storage";
import { randomBytes, runSync } from "@/lib/sync";

import { Icon } from "./Icon";

/** Optional end-to-end-encrypted sync of plan, profile and appointment questions between the person's devices. */
export function SyncCard() {
  const t = useT();
  const lang = useLocale();
  const [state, , loaded] = useLocalState<SyncState | null>(STORAGE_KEYS.sync, null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [entering, setEntering] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void browserApi().sync.meta().then((m) => setAvailable(m.enabled), () => setAvailable(false));
  }, []);

  const sync = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await runSync();
    } catch {
      setMessage(t("sync.failed"));
    } finally {
      setBusy(false);
    }
  };

  const start = (code: string) => {
    writeLocal(STORAGE_KEYS.sync, { code, version: 0, base: null, last_synced_at: null } satisfies SyncState);
    setShowCode(true);
    void sync();
  };

  const connect = (event: FormEvent) => {
    event.preventDefault();
    const code = normalizeSyncCode(codeInput);
    if (!code) {
      setMessage(t("sync.invalidCode"));
      return;
    }
    setEntering(false);
    setCodeInput("");
    start(code);
  };

  const turnOff = async () => {
    if (!state || !window.confirm(t("sync.turnOffConfirm"))) return;
    setBusy(true);
    try {
      await deleteRemoteCopy(browserApi(), state.code);
    } catch {
      /* offline: the copy expires on the server; this device stops either way */
    } finally {
      removeLocal(STORAGE_KEYS.sync);
      setBusy(false);
      setMessage(t("sync.off"));
    }
  };

  if (!loaded || available === null) return null;
  return (
    <section className="card mt-8 space-y-3 p-5" aria-labelledby="sync">
      <h2 id="sync" className="flex items-center gap-2 font-semibold text-ink">
        <Icon name="cloud" size={18} />
        {t("sync.title")}
      </h2>
      <p className="text-sm text-ink-2">{t("sync.intro")}</p>
      {!available ? (
        <p className="text-sm text-ink-3">{t("sync.unavailable")}</p>
      ) : !state ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => start(generateSyncCode(randomBytes))}>
              <Icon name="lock" size={16} />
              {t("sync.turnOn")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEntering((v) => !v)} aria-expanded={entering}>
              <Icon name="key" size={16} />
              {t("sync.haveCode")}
            </button>
          </div>
          {entering ? (
            <form onSubmit={connect} className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 space-y-1 text-sm">
                <span className="block font-semibold text-ink">{t("sync.enterCode")}</span>
                <input
                  className="field w-full font-mono uppercase"
                  value={codeInput}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                />
              </label>
              <button type="submit" className="btn btn-primary">
                {t("sync.connect")}
              </button>
            </form>
          ) : null}
        </>
      ) : (
        <>
          <div className="space-y-2 rounded-xl bg-surface-2 p-3">
            <p className="text-sm font-semibold text-ink">{t("sync.code")}</p>
            <code className="block break-all font-mono text-sm tracking-wider text-ink" aria-live="polite">
              {showCode ? state.code : state.code.replace(/[0-9A-Z]/g, "•")}
            </code>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost !min-h-9 text-sm" onClick={() => setShowCode((v) => !v)} aria-pressed={showCode}>
                {showCode ? t("sync.hide") : t("sync.show")}
              </button>
              <button
                type="button"
                className="btn btn-ghost !min-h-9 text-sm"
                onClick={() => void navigator.clipboard?.writeText(state.code).then(() => setCopied(true), () => undefined)}
              >
                <Icon name={copied ? "check" : "copy"} size={16} />
                {copied ? t("common.copied") : t("common.copy")}
              </button>
            </div>
            <p className="text-xs text-ink-2">{t("sync.codeHelp")}</p>
          </div>
          <p className="text-sm text-ink-2" role="status">
            {busy ? t("sync.syncing") : state.last_synced_at ? t("sync.lastSynced", { date: formatDate(lang, state.last_synced_at) }) : t("sync.notYet")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void sync()}>
              <Icon name="refresh" size={16} />
              {t("sync.syncNow")}
            </button>
            <button type="button" className="btn btn-ghost !text-critical" disabled={busy} onClick={() => void turnOff()}>
              <Icon name="x" size={16} />
              {t("sync.turnOff")}
            </button>
          </div>
        </>
      )}
      {message ? (
        <p role="status" className="text-sm text-ink-2">
          {message}
        </p>
      ) : null}
    </section>
  );
}
