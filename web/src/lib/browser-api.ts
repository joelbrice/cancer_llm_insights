"use client";

import { VitaCiteClient } from "@vitacite/shared";

import { readSession } from "./storage";

export const ADMIN_KEY_STORAGE = "vitacite.adminKey";

let client: VitaCiteClient | null = null;

/** Browser API client. Same-origin by default (/api/v1 is proxied to the backend). */
export function browserApi(): VitaCiteClient {
  if (!client) {
    client = new VitaCiteClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
      timeoutMs: 30_000,
      adminKey: () => readSession(ADMIN_KEY_STORAGE),
    });
  }
  return client;
}
