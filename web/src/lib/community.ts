"use client";

import { ApiError, communityErrorCode, STORAGE_KEYS, type Translate } from "@stepwell/shared";

import { useLocalState } from "./storage";

/** The pseudonymous member token lives only in this browser (localStorage). */
export function useCommunityToken() {
  return useLocalState<string | null>(STORAGE_KEYS.communityToken, null);
}

/** Human message for a community API error, in the reader's language. */
export function communityError(t: Translate, error: unknown): string {
  const code = error instanceof ApiError ? communityErrorCode(error.message) : null;
  if (code) return t(`community.errors.${code}`);
  if (error instanceof ApiError && error.isRateLimited) return t("community.errors.slow_down");
  return t("community.errors.generic");
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
