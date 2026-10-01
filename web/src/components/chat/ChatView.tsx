"use client";

import {
  ApiError,
  STORAGE_KEYS,
  type ChatEvent,
  type ChatResponse,
  type Citation,
  type Profile,
  type SafetyAssessment,
} from "@stepwell/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { useLocale, useT } from "@/lib/i18n-client";
import { readLocal, readSession, writeSession } from "@/lib/storage";

import { Icon } from "../Icon";
import { AnswerCard } from "./AnswerCard";
import { CitationDialog } from "./CitationDialog";

type Stage = "searching" | "found" | "writing" | "verifying" | "done" | "error";

export interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  stage?: Stage;
  found?: number;
  safety?: SafetyAssessment;
  response?: ChatResponse;
  error?: string;
}

const SESSION_KEY = STORAGE_KEYS.conversation;

export function ChatView({ initialQuestion }: { initialQuestion?: string }) {
  const t = useT();
  const lang = useLocale();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Restore this tab's conversation (session-only: closed tab = forgotten conversation).
  useEffect(() => {
    try {
      const saved = readSession(SESSION_KEY);
      if (saved) setTurns((JSON.parse(saved) as Turn[]).filter((turn) => turn.role === "user" || turn.response));
    } catch {
      /* ignore corrupt state */
    }
  }, []);

  useEffect(() => {
    if (!busy) writeSession(SESSION_KEY, JSON.stringify(turns.slice(-20)));
  }, [turns, busy]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  const patch = useCallback((id: string, update: Partial<Turn> | ((turn: Turn) => Partial<Turn>)) => {
    setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, ...(typeof update === "function" ? update(turn) : update) } : turn)));
  }, []);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy) return;
      const userTurn: Turn = { id: crypto.randomUUID(), role: "user", content: text };
      const assistantId = crypto.randomUUID();
      const history = [...turns, userTurn]
        .filter((turn) => turn.role === "user" || turn.response)
        .slice(-12)
        .map((turn) => ({ role: turn.role, content: turn.role === "user" ? turn.content : (turn.response?.answer ?? "") }))
        .filter((m) => m.content);
      setTurns((all) => [...all, userTurn, { id: assistantId, role: "assistant", content: "", stage: "searching" }]);
      setInput("");
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const profile = readLocal<Profile | null>(STORAGE_KEYS.profile, null);
      try {
        await browserApi().chatStream(
          { messages: history, ui_language: lang, profile: profile ?? undefined },
          (event: ChatEvent) => {
            switch (event.type) {
              case "meta":
                patch(assistantId, { safety: event.data.safety });
                break;
              case "evidence":
                patch(assistantId, { stage: "found", found: event.data.evidence.length });
                break;
              case "delta":
                patch(assistantId, (turn) => ({ stage: "writing", content: turn.content + event.data.text }));
                break;
              case "final":
                patch(assistantId, { stage: "done", response: event.data, content: event.data.answer, safety: event.data.safety });
                break;
              case "error":
                patch(assistantId, { stage: "error", error: event.data.message });
                break;
              default:
                break;
            }
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          patch(assistantId, (turn) => ({ stage: turn.response ? "done" : "error", error: turn.response ? undefined : t("ask.errorStream") }));
        } else {
          const message =
            err instanceof ApiError && err.isRateLimited ? t("ask.rateLimited") : err instanceof ApiError && err.status < 500 ? err.message : t("common.apiUnreachable");
          patch(assistantId, { stage: "error", error: message });
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, turns, lang, patch, t],
  );

  useEffect(() => {
    if (initialQuestion && !started.current) {
      started.current = true;
      void send(initialQuestion);
    }
  }, [initialQuestion, send]);

  const suggestions = [t("ask.s1"), t("ask.s2"), t("ask.s3"), t("ask.s4")];

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("ask.title")}</h1>
          <p className="mt-1 text-ink-2">{t("ask.subtitle")}</p>
        </div>
        {turns.length ? (
          <button
            type="button"
            className="btn btn-ghost shrink-0"
            onClick={() => {
              abortRef.current?.abort();
              setTurns([]);
              writeSession(SESSION_KEY, null);
            }}
          >
            <Icon name="plus" size={18} />
            <span className="hidden sm:inline">{t("ask.newChat")}</span>
          </button>
        ) : null}
      </div>

      <div className="mt-6 space-y-6" aria-live="polite" aria-busy={busy}>
        {turns.length === 0 ? (
          <section aria-labelledby="suggestions" className="card p-5">
            <h2 id="suggestions" className="mb-3 text-sm font-semibold text-ink-2">
              {t("ask.suggestions")}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" className="btn btn-ghost !min-h-10 text-left !font-medium" onClick={() => void send(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {turns.map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-on-brand">{turn.content}</p>
            </div>
          ) : (
            <AnswerCard key={turn.id} turn={turn} onCitation={setOpenCitation} />
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-30 mt-6 bg-[linear-gradient(to_top,var(--bg)_75%,transparent)] pb-2 pt-6 lg:bottom-0"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-3xl border border-line-strong bg-surface p-2 shadow-card">
          <label htmlFor="ask-input" className="sr-only">
            {t("ask.placeholder")}
          </label>
          <textarea
            id="ask-input"
            rows={1}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-base text-ink outline-none placeholder:text-ink-3"
            placeholder={t("ask.placeholder")}
            value={input}
            maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          {busy ? (
            <button type="button" className="btn btn-ghost" onClick={() => abortRef.current?.abort()}>
              <Icon name="stop" size={18} />
              <span className="sr-only sm:not-sr-only">{t("ask.stop")}</span>
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={!input.trim()}>
              <Icon name="send" size={18} />
              <span className="sr-only sm:not-sr-only">{t("ask.send")}</span>
            </button>
          )}
        </div>
        <p className="mt-2 px-3 text-center text-xs text-ink-3">{t("disclaimer.short")}</p>
      </form>

      <CitationDialog citation={openCitation} onClose={() => setOpenCitation(null)} />
    </div>
  );
}
