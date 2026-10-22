"use client";

import type { BlockedMember, MemberMe } from "@stepwell/shared";
import { useEffect, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { communityError } from "@/lib/community";
import { useT } from "@/lib/i18n-client";

import { Icon } from "../Icon";

export function AccountPanel({ me, token, onSignedOut }: { me: MemberMe; token: string; onSignedOut: (message?: string) => void }) {
  const t = useT();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlockedMember[]>([]);
  const [showBlocks, setShowBlocks] = useState(false);

  useEffect(() => {
    if (showBlocks) void browserApi().community.blocks(token).then(setBlocks, () => setBlocks([]));
  }, [showBlocks, token]);

  const unblock = async (block: BlockedMember) => {
    try {
      await browserApi().community.unblock(token, block.id);
      setBlocks((list) => list.filter((b) => b.id !== block.id));
    } catch (e) {
      setError(communityError(t, e));
    }
  };

  const download = async () => {
    try {
      const data = await browserApi().community.exportMe(token);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "stepwell-community-data.json" });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(communityError(t, e));
    }
  };

  const leave = async () => {
    if (!window.confirm(t("community.leaveConfirm"))) return;
    try {
      await browserApi().community.eraseMe(token);
      onSignedOut(t("community.left"));
    } catch (e) {
      setError(communityError(t, e));
    }
  };

  return (
    <section className="card space-y-3 p-4" aria-labelledby="account">
      <h2 id="account" className="font-semibold text-ink">
        {t("community.account")}
      </h2>
      <p className="text-sm text-ink-2">{t("community.signedInAs", { handle: me.member.handle })}</p>
      {me.member.status === "suspended" ? <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning-ink">{t("community.errors.member_suspended")}</p> : null}
      <div>
        <button type="button" className="btn btn-ghost w-full !justify-start text-sm" onClick={() => setShowKey((s) => !s)} aria-expanded={showKey}>
          <Icon name="key" size={16} />
          {t("community.accessKey")}
        </button>
        {showKey ? (
          <div className="mt-2 space-y-2 rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-ink-2">{t("community.accessKeyHelp")}</p>
            <code className="block break-all rounded-lg bg-surface p-2 text-xs">{token}</code>
            <button
              type="button"
              className="btn btn-ghost !min-h-9 text-sm"
              onClick={() => void navigator.clipboard?.writeText(token).then(() => setCopied(true), () => undefined)}
            >
              <Icon name={copied ? "check" : "copy"} size={16} />
              {copied ? t("common.copied") : t("community.copyKey")}
            </button>
          </div>
        ) : null}
      </div>
      <div>
        <button type="button" className="btn btn-ghost w-full !justify-start text-sm" onClick={() => setShowBlocks((v) => !v)} aria-expanded={showBlocks}>
          <Icon name="ban" size={16} />
          {t("community.blockedMembers")}
        </button>
        {showBlocks ? (
          <ul className="mt-2 space-y-1 rounded-xl bg-surface-2 p-2 text-sm">
            {blocks.length ? (
              blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 px-1">
                  <span className="truncate">{b.handle}</span>
                  <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => void unblock(b)}>
                    {t("community.unblock")}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-1 text-ink-2">{t("community.noBlocks")}</li>
            )}
          </ul>
        ) : null}
      </div>
      <button type="button" className="btn btn-ghost w-full !justify-start text-sm" onClick={() => void download()}>
        <Icon name="download" size={16} />
        {t("community.exportData")}
      </button>
      <button type="button" className="btn btn-ghost w-full !justify-start text-sm" onClick={() => window.confirm(t("community.signOutConfirm")) && onSignedOut()}>
        <Icon name="logout" size={16} />
        {t("community.signOut")}
      </button>
      <button type="button" className="btn btn-ghost w-full !justify-start text-sm !text-critical" onClick={() => void leave()}>
        <Icon name="trash" size={16} />
        {t("community.leave")}
      </button>
      {error ? <p className="text-sm text-critical">{error}</p> : null}
    </section>
  );
}
