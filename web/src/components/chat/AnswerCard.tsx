"use client";

import {
  splitCitations,
  translateDynamic,
  type ChatResponse,
  type Citation,
  type ClaimCheck,
  type SafetyAssessment,
  type Translate,
} from "@stepwell/shared";
import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";

import { browserApi } from "@/lib/browser-api";
import { useLocale, useT } from "@/lib/i18n-client";

import { CitationCard, EvidenceBadge } from "../evidence";
import { Icon } from "../Icon";
import type { Turn } from "./ChatView";

/** Render **bold** runs inside plain text without using innerHTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

function withCitations(text: string, citations: Map<number, Citation>, onCitation: (c: Citation) => void, t: Translate): ReactNode[] {
  return splitCitations(text).map((segment, i) => (
    <Fragment key={i}>
      {inline(segment.text)}
      {segment.citations.map((n) => {
        const citation = citations.get(n);
        return citation ? (
          <button
            key={n}
            type="button"
            className="cite"
            onClick={() => onCitation(citation)}
            aria-label={`${t("ask.sources")} ${n}: ${citation.source.title}`}
          >
            {n}
          </button>
        ) : (
          <span key={n} className="cite opacity-60" aria-hidden="true">
            {n}
          </span>
        );
      })}
    </Fragment>
  ));
}

/** Answer text with every flagged claim visibly marked (wavy = not verified, dotted = partly supported). */
export function AnswerBody({ response, onCitation }: { response: ChatResponse; onCitation: (c: Citation) => void }) {
  const t = useT();
  const citations = new Map(response.citations.map((c) => [c.n, c]));
  const answer = response.answer;
  const claims = [...(response.verification?.claims ?? [])].sort((a, b) => a.start - b.start);
  const pieces: ReactNode[] = [];
  let cursor = 0;
  const flag = (claim: ClaimCheck) =>
    claim.label === "unsupported"
      ? { cls: "claim-unsupported", note: t("ask.claimUnsupported") }
      : claim.label === "partial"
        ? { cls: "claim-partial", note: t("ask.claimPartial") }
        : claim.label === "no_citation"
          ? { cls: "claim-partial", note: t("ask.claimUncited") }
          : null;
  for (const claim of claims) {
    if (claim.start < cursor) continue;
    if (claim.start > cursor) pieces.push(<Fragment key={`g${cursor}`}>{withCitations(answer.slice(cursor, claim.start), citations, onCitation, t)}</Fragment>);
    const marked = flag(claim);
    const content = withCitations(answer.slice(claim.start, claim.end), citations, onCitation, t);
    pieces.push(
      marked ? (
        <span key={`c${claim.start}`} className={marked.cls} title={marked.note}>
          {content}
          <span className="sr-only"> ({marked.note})</span>
        </span>
      ) : (
        <Fragment key={`c${claim.start}`}>{content}</Fragment>
      ),
    );
    cursor = claim.end;
  }
  if (cursor < answer.length) pieces.push(<Fragment key="tail">{withCitations(answer.slice(cursor), citations, onCitation, t)}</Fragment>);
  return <div className="prose-answer text-[1.02rem] text-ink">{pieces}</div>;
}

export function SafetyBanner({ safety }: { safety: SafetyAssessment }) {
  const t = useT();
  if (safety.level === "none" || !safety.notices.length) return null;
  const severe = safety.level === "emergency" || safety.level === "urgent";
  const title = safety.level === "emergency" ? t("ask.emergencyTitle") : safety.level === "urgent" ? t("ask.urgentTitle") : t("ask.cautionTitle");
  return (
    <div
      role={severe ? "alert" : "note"}
      className={`rounded-2xl border p-4 ${severe ? "border-critical bg-critical-soft" : "border-warning bg-warning-soft"}`}
    >
      <p className={`flex items-center gap-2 font-semibold ${severe ? "text-critical" : "text-warning-ink"}`}>
        <Icon name={severe ? "octagon" : "alert"} size={20} />
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-ink">
        {safety.notices.map((notice) => (
          <li key={notice.rule}>{notice.message}</li>
        ))}
      </ul>
      {safety.resources.length ? (
        <div className="mt-3">
          <p className="text-sm font-semibold text-ink">{t("ask.crisisResources")}</p>
          <ul className="mt-1 space-y-1">
            {safety.resources.map((r) => (
              <li key={r.name} className="flex items-center gap-2 text-sm">
                <Icon name="phone" size={16} className="shrink-0" />
                <span className="font-semibold">{r.contact}</span>
                <span className="text-ink-2">— {r.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Feedback({ response }: { response: ChatResponse }) {
  const t = useT();
  const lang = useLocale();
  const [sent, setSent] = useState<1 | -1 | null>(null);
  const send = async (rating: 1 | -1) => {
    setSent(rating);
    try {
      await browserApi().feedback({
        target_type: "answer",
        target_id: response.id,
        rating,
        reasons: rating === 1 ? ["helpful"] : ["not_supported"],
        language: lang,
      });
    } catch {
      /* feedback is best-effort */
    }
  };
  if (sent) return <p className="text-sm text-ink-2">{t("ask.thanks")}</p>;
  return (
    <div className="flex gap-2">
      <button type="button" className="btn btn-ghost !min-h-9 !px-3 text-sm" onClick={() => void send(1)}>
        <Icon name="thumbUp" size={16} />
        {t("ask.helpful")}
      </button>
      <button type="button" className="btn btn-ghost !min-h-9 !px-3 text-sm" onClick={() => void send(-1)}>
        <Icon name="thumbDown" size={16} />
        {t("ask.notHelpful")}
      </button>
    </div>
  );
}

function Progress({ turn }: { turn: Turn }) {
  const t = useT();
  const label =
    turn.stage === "searching"
      ? t("ask.searching")
      : turn.stage === "found"
        ? t("ask.found", { n: turn.found ?? 0 })
        : turn.stage === "writing"
          ? t("ask.writing")
          : t("ask.verifying");
  return (
    <p className="flex items-center gap-2 text-sm text-ink-2" role="status">
      <span className="typing inline-flex gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
      </span>
      {label}
    </p>
  );
}

export function AnswerCard({ turn, onCitation }: { turn: Turn; onCitation: (c: Citation) => void }) {
  const t = useT();
  const lang = useLocale();
  const response = turn.response;
  const safety = response?.safety ?? turn.safety;
  const [copied, setCopied] = useState(false);

  return (
    <article className="space-y-3">
      {safety ? <SafetyBanner safety={safety} /> : null}
      {response?.abstain_reason === "safety" ? null : (
      <div className="card p-5">
        {turn.stage === "error" ? (
          <p className="flex items-center gap-2 text-ink" role="alert">
            <Icon name="alert" className="text-warning-ink" />
            {turn.error}
          </p>
        ) : !response ? (
          <div className="space-y-3">
            {turn.content ? <div className="prose-answer text-ink">{turn.content}</div> : null}
            <Progress turn={turn} />
          </div>
        ) : response.abstained ? (
          <div>
            <p className="mb-2 flex items-center gap-2 font-semibold text-ink">
              <Icon name="info" className="text-ink-2" />
              {t("ask.abstainedTitle")}
            </p>
            <div className="prose-answer text-ink-2">{response.answer}</div>
          </div>
        ) : (
          <div className="space-y-4">
            <AnswerBody response={response} onCitation={onCitation} />
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {response.evidence ? <EvidenceBadge level={response.evidence.level} grade={response.evidence.grade} t={t} /> : null}
              {response.verification ? (
                <span className="chip">
                  <Icon name="check" size={14} />
                  {t("ask.grounded", { pct: Math.round(response.verification.grounded_ratio * 100) })}
                </span>
              ) : null}
              {response.model === "extractive" ? <span className="chip">{t("ask.extractiveNote")}</span> : null}
            </div>
            {response.evidence ? (
              <details className="group rounded-xl bg-surface-2 p-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink">
                  <Icon name="chevronDown" size={16} className="transition group-open:rotate-180" />
                  {t("insights.whyGrade")}
                </summary>
                <p className="mt-2 text-sm text-ink-2">{t(`levels.${response.evidence.level}Desc`)}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                  {response.evidence.rationale.map((r) => (
                    <li key={r.code}>{r.text}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {response.citations?.length ? (
              <details className="group" open={response.citations.length <= 3}>
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink">
                  <Icon name="chevronDown" size={16} className="transition group-open:rotate-180" />
                  {t("ask.sources")} ({response.citations.length})
                </summary>
                <ol className="mt-3 space-y-3">
                  {response.citations.map((c) => (
                    <CitationCard key={c.n} citation={c} t={t} anchorPrefix={`${response.id}-ref`} />
                  ))}
                </ol>
              </details>
            ) : null}
          </div>
        )}
      </div>
      )}
      {response && !response.abstained ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <Feedback response={response} />
          <button
            type="button"
            className="btn btn-ghost !min-h-9 !px-3 text-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(response.answer).then(() => setCopied(true));
            }}
          >
            <Icon name={copied ? "check" : "copy"} size={16} />
            {copied ? t("common.copied") : t("ask.copyAnswer")}
          </button>
        </div>
      ) : null}
      {response?.related_insights?.length ? (
        <nav aria-label={t("ask.related")} className="px-1">
          <p className="mb-2 text-sm font-semibold text-ink-2">{t("ask.related")}</p>
          <ul className="flex flex-wrap gap-2">
            {response.related_insights.map((r) => (
              <li key={r.id}>
                <Link href={`/${lang}/insights/${encodeURIComponent(r.id)}`} className="chip hover:border-line-strong hover:text-ink">
                  <Icon name="spark" size={14} />
                  {r.title}
                  <span className="text-ink-3">· {translateDynamic(t, "levels", r.evidence_level)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
