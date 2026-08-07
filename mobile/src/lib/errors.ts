/**
 * Turns a thrown value into something a person can read and act on.
 *
 * Before this, screens rendered `error.message` directly, so a self-hosted
 * server being down produced the literal string "fetch failed:
 * UnexpectedException: Could not connect to the server. (at
 * ExpoModulesCore/Promise.swift:56)" centered on an otherwise empty Home tab —
 * a stack trace as an empty state. `ApiError` messages *are* human (the Go API
 * writes them), so those pass through; everything else gets replaced.
 *
 * One function serves both surfaces: `describeError` for the full-screen and
 * card states, `errorMessage` for the ~40 mutation `Alert.alert` bodies.
 */

import { t } from '@lingui/core/macro';
import type { SFSymbol } from 'expo-symbols';

import { ApiError, NetworkError, UnauthorizedError } from '@/api/client';

export type ErrorDescription = {
  title: string;
  description: string;
  systemImage: SFSymbol;
  /**
   * Whether retrying could plausibly work. False for "the server understood
   * and said no" (403/404) — offering Try again there just teaches the user
   * the button is a lie.
   */
  retryable: boolean;
};

function host(serverUrl: string): string {
  try {
    return new URL(serverUrl).host;
  } catch {
    return serverUrl;
  }
}

export function describeError(error: unknown): ErrorDescription {
  if (error instanceof NetworkError) {
    return {
      title: t`Can't reach the server`,
      description: t`No response from ${host(error.serverUrl)}. Check your connection, or that the server is running and reachable from this network.`,
      systemImage: 'wifi.slash',
      retryable: true,
    };
  }

  if (error instanceof UnauthorizedError) {
    return {
      title: t`Signed out`,
      description: t`This session expired. Sign in again to continue.`,
      systemImage: 'person.crop.circle.badge.exclamationmark',
      retryable: false,
    };
  }

  if (error instanceof ApiError) {
    if (error.status === 403) {
      return {
        title: t`Not allowed`,
        description: t`This account doesn't have access to that.`,
        systemImage: 'lock',
        retryable: false,
      };
    }
    if (error.status === 404) {
      return {
        title: t`Not found`,
        description: t`This item no longer exists. It may have been deleted.`,
        systemImage: 'questionmark.circle',
        retryable: false,
      };
    }
    if (error.status === 429) {
      return {
        title: t`Too many requests`,
        description: t`The server is rate limiting this app. Try again in a moment.`,
        systemImage: 'clock.arrow.circlepath',
        retryable: true,
      };
    }
    if (error.status >= 500) {
      return {
        title: t`Server error`,
        description: t`The server couldn't handle this request. If it keeps happening, check the server logs.`,
        systemImage: 'exclamationmark.triangle',
        retryable: true,
      };
    }
    // 4xx below 429: the API's own message is the most specific thing we have.
    return {
      title: t`Something went wrong`,
      description: error.message,
      systemImage: 'exclamationmark.triangle',
      retryable: false,
    };
  }

  return {
    title: t`Something went wrong`,
    description: error instanceof Error && error.message ? error.message : t`Unexpected error.`,
    systemImage: 'exclamationmark.triangle',
    retryable: true,
  };
}

/**
 * One line for an `Alert` body or a compact inline row. Network failures lose
 * the host here — the alert already names the action that failed, and the full
 * explanation belongs on a screen, not in a modal the user has to dismiss.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return t`Could not reach the server. Check your connection and try again.`;
  }
  if (error instanceof UnauthorizedError) return t`Your session expired. Sign in again.`;
  if (error instanceof ApiError && error.status < 500) return error.message;
  return describeError(error).description;
}

/** True when the failure is "no response", i.e. the server, not the request. */
export function isUnreachable(error: unknown): boolean {
  return error instanceof NetworkError;
}
