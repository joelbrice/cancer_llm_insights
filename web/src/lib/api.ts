import "server-only";

import { ApiError, VitaCiteClient } from "@vitacite/shared";
import { connection } from "next/server";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

/** Server-side API client (server components). Data is per request: never prerendered at build time. */
export const api = new VitaCiteClient({
  baseUrl: API_INTERNAL_URL,
  timeoutMs: 15_000,
  fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
});

export type Result<T> = { data: T; error: null } | { data: null; error: { status: number; message: string } };

/** Await an API call without throwing: pages render a friendly state when the API is down or returns 404. */
export async function load<T>(call: () => Promise<T>): Promise<Result<T>> {
  await connection();
  try {
    return { data: await call(), error: null };
  } catch (err) {
    if (err instanceof ApiError) return { data: null, error: { status: err.status, message: err.message } };
    return { data: null, error: { status: 503, message: err instanceof Error ? err.message : "unreachable" } };
  }
}
