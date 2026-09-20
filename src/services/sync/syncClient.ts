/**
 * Sync transport.
 *
 * Speaks a small REST contract (documented in README.md next to this file).
 * Isolated behind an interface so the engine can be tested against a mock and
 * a real backend can be swapped in without touching sync logic.
 */

import { SYNC_API_URL, SYNC_CONFIG } from '@/config/sync.config';
import type { SyncOperation } from '@/types/domain';

export interface SyncItem {
  /** Queue entry id. */
  id: string;
  /** Stable key so a retry cannot create a second record server-side. */
  idempotencyKey: string;
  entity: string;
  entityId: string;
  operation: SyncOperation;
  payload: unknown;
  /** Local revision, used for conflict detection on editable records. */
  rev: number;
  /** When the change was made locally. */
  updatedAt: string;
}

/** Per-item outcome returned by the server. */
export interface SyncItemResult {
  id: string;
  status: 'accepted' | 'duplicate' | 'conflict' | 'rejected';
  /** Authoritative record when the server won a conflict. */
  serverRecord?: Record<string, unknown>;
  message?: string;
}

export interface PushResult {
  ok: boolean;
  results: SyncItemResult[];
  /** Set when the whole request failed rather than individual items. */
  error?: string;
  /** True when the failure is worth retrying (network, 5xx, timeout). */
  retryable?: boolean;
}

export interface SyncClient {
  readonly configured: boolean;
  push(items: SyncItem[]): Promise<PushResult>;
  ping(): Promise<boolean>;
}

/** REST client for the documented contract. */
export class HttpSyncClient implements SyncClient {
  constructor(private readonly endpoint: string) {}

  get configured(): boolean {
    return this.endpoint.length > 0;
  }

  private async request(path: string, body?: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SYNC_CONFIG.requestTimeoutMs,
    );

    try {
      return await fetch(`${this.endpoint}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined
          ? undefined
          : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.request('/health');
      return response.ok;
    } catch {
      return false;
    }
  }

  async push(items: SyncItem[]): Promise<PushResult> {
    if (items.length === 0) return { ok: true, results: [] };

    try {
      const response = await this.request('/sync', { items });

      if (!response.ok) {
        // 5xx and 429 are transient; 4xx means the request itself is wrong.
        const retryable = response.status >= 500 || response.status === 429;
        return {
          ok: false,
          results: [],
          error: `Server responded ${response.status}`,
          retryable,
        };
      }

      const data = (await response.json()) as { results?: SyncItemResult[] };
      return { ok: true, results: data.results ?? [] };
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return {
        ok: false,
        results: [],
        error: aborted ? 'Request timed out' : 'Could not reach the server',
        retryable: true,
      };
    }
  }
}

/** No endpoint configured: sync is inert but the queue still accumulates. */
export class DisabledSyncClient implements SyncClient {
  readonly configured = false;
  async push(): Promise<PushResult> {
    return { ok: false, results: [], error: 'Sync is not configured' };
  }
  async ping(): Promise<boolean> {
    return false;
  }
}

export function createSyncClient(url: string = SYNC_API_URL): SyncClient {
  return url ? new HttpSyncClient(url) : new DisabledSyncClient();
}
