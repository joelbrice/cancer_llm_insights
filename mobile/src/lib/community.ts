import { ApiError, communityErrorCode, STORAGE_KEYS, type Translate } from "@stepwell/shared";

import { useStored } from "./storage";

/** Pseudonymous member token, stored only on this device. */
export function useCommunityToken() {
  return useStored<string | null>(STORAGE_KEYS.communityToken, null);
}

export function communityMessage(t: Translate, error: unknown): string {
  const code = error instanceof ApiError ? communityErrorCode(error.message) : null;
  if (code) return t(`community.errors.${code}`);
  if (error instanceof ApiError && error.isRateLimited) return t("community.errors.slow_down");
  return t("community.errors.generic");
}

export const isAuthError = (error: unknown) => error instanceof ApiError && error.status === 401;
