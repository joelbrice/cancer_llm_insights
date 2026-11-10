/**
 * Optional end-to-end-encrypted sync of a person's plan, profile and appointment questions between their devices.
 *
 * A random sync code (160 bits, shown as 8 groups of 4 characters) is the only secret. From it, HKDF-SHA256
 * derives three independent values:
 *   - `id`   where the encrypted copy lives on the server (64 hex characters);
 *   - `auth` a write secret sent as a bearer token (the server stores only its SHA-256);
 *   - `key`  the XChaCha20-Poly1305 key, which never leaves the device.
 * The server stores ciphertext it cannot read. There is no account and nothing to recover: losing the code means
 * starting again (the data stays on each device).
 *
 * Concurrent edits are merged three-way against the last synced snapshot, so a plan item removed on one device
 * is not resurrected by another, and check-ins made on two devices are both kept.
 */
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import type { AppointmentState } from "./appointment";
import { ApiError, type StepwellClient } from "./client";
import type { PlanItem } from "./plan";
import type { Profile } from "./types";

export type RandomBytes = (length: number) => Uint8Array;

/** Crockford base32: no I, L, O or U, so codes are easy to read aloud and type. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_BYTES = 20;
const CODE_CHARS = 32;
const SALT = utf8("stepwell-sync-v1");
const NONCE_BYTES = 24;

export interface SyncKeys {
  id: string;
  auth: string;
  key: Uint8Array;
}

export interface SyncPayload {
  v: 1;
  plan: PlanItem[];
  profile: Profile | null;
  questions: AppointmentState | null;
}

export interface SyncState {
  /** The sync code (grouped). Stored on the device only. */
  code: string;
  /** Server version this device last saw. */
  version: number;
  /** Snapshot of the last successful sync: the common ancestor for three-way merges. */
  base: SyncPayload | null;
  last_synced_at: string | null;
}

export const EMPTY_SYNC_PAYLOAD: SyncPayload = { v: 1, plan: [], profile: null, questions: null };

// ── codes and keys ────────────────────────────────────────────────────────────────────────────────────────
export function generateSyncCode(random: RandomBytes): string {
  return group(base32Encode(random(CODE_BYTES)));
}

/** Accepts lower case, spaces and dashes, and the usual look-alikes (O→0, I/L→1). Returns null when invalid. */
export function normalizeSyncCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (cleaned.length !== CODE_CHARS || [...cleaned].some((c) => !ALPHABET.includes(c))) return null;
  return group(cleaned);
}

export function deriveSyncKeys(code: string): SyncKeys {
  const normalized = normalizeSyncCode(code);
  if (!normalized) throw new Error("invalid sync code");
  const ikm = base32Decode(normalized.replace(/-/g, ""));
  const part = (info: string) => hkdf(sha256, ikm, SALT, utf8(info), 32);
  return { id: hex(part("id")), auth: base64url(part("auth")), key: part("key") };
}

// ── encryption ────────────────────────────────────────────────────────────────────────────────────────────
export function encryptPayload(keys: SyncKeys, payload: SyncPayload, random: RandomBytes): string {
  const nonce = random(NONCE_BYTES);
  const sealed = xchacha20poly1305(keys.key, nonce, utf8(keys.id)).encrypt(utf8(JSON.stringify(payload)));
  const out = new Uint8Array(nonce.length + sealed.length);
  out.set(nonce);
  out.set(sealed, nonce.length);
  return base64url(out);
}

/** Throws if the ciphertext was altered or the key is wrong. */
export function decryptPayload(keys: SyncKeys, ciphertext: string): SyncPayload {
  const raw = fromBase64url(ciphertext);
  const nonce = raw.subarray(0, NONCE_BYTES);
  const opened = xchacha20poly1305(keys.key, nonce, utf8(keys.id)).decrypt(raw.subarray(NONCE_BYTES));
  const value = JSON.parse(fromUtf8(opened)) as Partial<SyncPayload>;
  return {
    v: 1,
    plan: Array.isArray(value.plan) ? value.plan : [],
    profile: value.profile ?? null,
    questions: value.questions ?? null,
  };
}

// ── three-way merge ───────────────────────────────────────────────────────────────────────────────────────
/** Union of both sides, minus what either side removed since the common ancestor. */
export function mergeSets<T>(base: readonly T[], local: readonly T[], remote: readonly T[]): T[] {
  const b = new Set(base);
  const l = new Set(local);
  const r = new Set(remote);
  const removed = new Set([...b].filter((x) => !l.has(x) || !r.has(x)));
  return [...new Set([...local, ...remote])].filter((x) => !removed.has(x));
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Field-level: a side that changed since the ancestor wins; if both changed, this device wins. */
function pick<T>(base: T | undefined, local: T, remote: T): T {
  return same(local, base) ? remote : local;
}

function mergeById<T extends { id: string }>(base: T[], local: T[], remote: T[], merge: (b: T | undefined, l: T, r: T) => T): T[] {
  const ids = mergeSets(base.map((x) => x.id), local.map((x) => x.id), remote.map((x) => x.id));
  const index = (list: T[]) => new Map(list.map((x) => [x.id, x]));
  const [bi, li, ri] = [index(base), index(local), index(remote)];
  return ids.map((id) => {
    const l = li.get(id);
    const r = ri.get(id);
    if (l && r) return merge(bi.get(id), l, r);
    return (l ?? r) as T;
  });
}

export function mergePayloads(base: SyncPayload | null, local: SyncPayload, remote: SyncPayload): SyncPayload {
  const b = base ?? EMPTY_SYNC_PAYLOAD;
  const plan = mergeById(b.plan, local.plan, remote.plan, (bp, l, r) => ({
    ...pick(bp, l, r),
    checkins: mergeSets(bp?.checkins ?? [], l.checkins, r.checkins).sort(),
  }));
  let questions: AppointmentState | null = pick(b.questions, local.questions, remote.questions);
  if (local.questions && remote.questions) {
    const bq = b.questions;
    questions = {
      selected: mergeSets(bq?.selected ?? [], local.questions.selected, remote.questions.selected),
      custom: mergeById(bq?.custom ?? [], local.questions.custom, remote.questions.custom, (bc, l, r) => pick(bc, l, r)),
      notes: { ...remote.questions.notes, ...changedEntries(bq?.notes ?? {}, local.questions.notes) },
    };
  }
  return { v: 1, plan, profile: pick(b.profile, local.profile, remote.profile), questions };
}

function changedEntries(base: Record<string, string>, local: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(local).filter(([k, v]) => base[k] !== v));
}

// ── one sync round ────────────────────────────────────────────────────────────────────────────────────────
export interface SyncOutcome {
  state: SyncState;
  /** The merged data. Write it to local storage when `changedLocal` is true. */
  payload: SyncPayload;
  changedLocal: boolean;
  /** The encrypted copy was deleted (sync turned off on another device): stop syncing here too. */
  stopped?: boolean;
}

/**
 * Pull, merge and push. Retries on a concurrent write (409). Network errors propagate to the caller, which
 * simply tries again later: the data is always safe on the device.
 */
export async function syncOnce(api: StepwellClient, state: SyncState, local: SyncPayload, random: RandomBytes): Promise<SyncOutcome> {
  const keys = deriveSyncKeys(state.code);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const remote = await api.sync.get(keys.id, keys.auth);
    if (!remote && state.version > 0) return { state, payload: local, changedLocal: false, stopped: true };
    const remotePayload = remote ? decryptPayload(keys, remote.ciphertext) : null;
    const merged = remotePayload ? mergePayloads(state.base, local, remotePayload) : local;
    const changedLocal = !same(merged, local);
    if (remote && remotePayload && same(merged, remotePayload)) {
      return { state: { ...state, version: remote.version, base: merged, last_synced_at: new Date().toISOString() }, payload: merged, changedLocal };
    }
    try {
      const saved = await api.sync.put(keys.id, keys.auth, encryptPayload(keys, merged, random), remote?.version ?? 0);
      return { state: { ...state, version: saved.version, base: merged, last_synced_at: saved.updated_at }, payload: merged, changedLocal };
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) continue; // another device wrote first: merge again
      throw e;
    }
  }
  throw new ApiError("sync conflict", 409);
}

/** Turning sync off removes the encrypted copy from the server; each device keeps its own data. */
export async function deleteRemoteCopy(api: StepwellClient, code: string): Promise<void> {
  const keys = deriveSyncKeys(code);
  try {
    await api.sync.remove(keys.id, keys.auth);
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
}

// ── encodings (no Buffer/TextEncoder dependency: works on Hermes, browsers and Node) ─────────────────────────
function group(code: string): string {
  return code.match(/.{1,4}/g)!.join("-");
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function base64url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >>> 18) & 63]! + B64[(n >>> 12) & 63]!;
    if (i + 1 < bytes.length) out += B64[(n >>> 6) & 63]!;
    if (i + 2 < bytes.length) out += B64[n & 63]!;
  }
  return out;
}

export function fromBase64url(text: string): Uint8Array {
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of text) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error("invalid base64url");
    value = (value << 6) | v;
    bits += 6;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    let c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else {
      c = Math.min(c, 0x10ffff);
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return Uint8Array.from(out);
}

export function fromUtf8(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i]!;
    let c: number;
    if (b < 0x80) (c = b), (i += 1);
    else if (b < 0xe0) (c = ((b & 31) << 6) | (bytes[i + 1]! & 63)), (i += 2);
    else if (b < 0xf0) (c = ((b & 15) << 12) | ((bytes[i + 1]! & 63) << 6) | (bytes[i + 2]! & 63)), (i += 3);
    else (c = ((b & 7) << 18) | ((bytes[i + 1]! & 63) << 12) | ((bytes[i + 2]! & 63) << 6) | (bytes[i + 3]! & 63)), (i += 4);
    out += String.fromCodePoint(c);
  }
  return out;
}
