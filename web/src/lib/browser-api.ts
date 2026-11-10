"use client";

import { StepwellClient } from "@stepwell/shared";

import { readSession } from "./storage";

export const ADMIN_KEY_STORAGE = "stepwell.adminKey";

let client: StepwellClient | null = null;

/** Browser API client. Same-origin by default (/api/v1 is proxied to the backend). */
export function browserApi(): StepwellClient {
  if (!client) {
    client = new StepwellClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
      timeoutMs: 30_000,
      adminKey: () => readSession(ADMIN_KEY_STORAGE),
    });
  }
  return client;
}
