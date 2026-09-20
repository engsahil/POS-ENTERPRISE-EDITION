/**
 * Synchronisation configuration.
 *
 * Sync is OFF unless `VITE_SYNC_API_URL` is set. With no endpoint the app is
 * a purely local POS: changes still queue durably, so enabling a backend
 * later uploads everything that accumulated in the meantime.
 *
 * Synchronisation never blocks billing. It runs in the background, and every
 * failure path leaves the till fully usable.
 */

export const SYNC_API_URL = import.meta.env.VITE_SYNC_API_URL ?? '';

export const SYNC_CONFIG = {
  /** Items pushed per request. Keeps payloads small on poor connections. */
  batchSize: 25,

  /** Attempts before an item is parked as failed and needs manual retry. */
  maxAttempts: 5,

  /**
   * Exponential backoff between attempts, in milliseconds. A failing server
   * must not be hammered, and the queue must not spin.
   */
  backoffMs: [1_000, 5_000, 15_000, 60_000, 300_000],

  /** How often to drain the queue while online and idle. */
  pollIntervalMs: 30_000,

  /** Per-request timeout. A hung request must never stall the queue. */
  requestTimeoutMs: 15_000,
} as const;

/** Backoff for a given attempt count, clamped to the last step. */
export function backoffFor(attempts: number): number {
  const steps = SYNC_CONFIG.backoffMs;
  return steps[Math.min(attempts, steps.length - 1)] ?? 300_000;
}
