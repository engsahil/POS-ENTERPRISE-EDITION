/**
 * Session persistence.
 *
 * The session lives in localStorage so a refresh or an app restart keeps the
 * operator signed in — important for a POS terminal that may reload. It stores
 * only an opaque token, the username and expiry: no password material.
 */

import type { AuthSession } from '@/types/auth';

const SESSION_KEY = 'pos.auth.session';
const ATTEMPTS_KEY = 'pos.auth.attempts';

function available(): boolean {
  try {
    const probe = '__pos_session_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const enabled = typeof window !== 'undefined' && available();

/** In-memory fallback so auth still works in private/blocked-storage modes. */
let memorySession: AuthSession | null = null;
let memoryAttempts: FailedAttempts | null = null;

export interface FailedAttempts {
  count: number;
  lockedUntil: number | null;
}

function isSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.token === 'string' &&
    typeof s.username === 'string' &&
    typeof s.issuedAt === 'number' &&
    typeof s.expiresAt === 'number'
  );
}

export const sessionStore = {
  read(): AuthSession | null {
    if (!enabled) return memorySession;
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  write(session: AuthSession): void {
    memorySession = session;
    if (!enabled) return;
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* storage full — the in-memory copy still works for this tab */
    }
  },

  clear(): void {
    memorySession = null;
    if (!enabled) return;
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* no-op */
    }
  },

  readAttempts(): FailedAttempts {
    const fallback: FailedAttempts = { count: 0, lockedUntil: null };
    if (!enabled) return memoryAttempts ?? fallback;
    try {
      const raw = window.localStorage.getItem(ATTEMPTS_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<FailedAttempts>;
      return {
        count: typeof parsed.count === 'number' ? parsed.count : 0,
        lockedUntil:
          typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null,
      };
    } catch {
      return fallback;
    }
  },

  writeAttempts(attempts: FailedAttempts): void {
    memoryAttempts = attempts;
    if (!enabled) return;
    try {
      window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    } catch {
      /* no-op */
    }
  },

  clearAttempts(): void {
    memoryAttempts = null;
    if (!enabled) return;
    try {
      window.localStorage.removeItem(ATTEMPTS_KEY);
    } catch {
      /* no-op */
    }
  },
};
