import type { ISODateString } from './common';
import type { AdminRecord } from './domain';

/**
 * Persisted admin credential record. Never contains a plaintext password.
 * Alias of the canonical AdminRecord so there is one shape, one store.
 */
export type AdminCredentials = AdminRecord;

/** The signed-in user as exposed to the UI. */
export interface AuthUser {
  username: string;
  role: 'admin';
  lastLoginAt?: ISODateString | null;
  mustChangePassword: boolean;
}

/** Persisted session. Holds no credential material. */
export interface AuthSession {
  token: string;
  username: string;
  issuedAt: number;
  expiresAt: number;
}

export type AuthStatus =
  | 'initialising'
  | 'authenticated'
  | 'unauthenticated'
  | 'error';

export interface LoginResult {
  ok: boolean;
  /** Human-readable, deliberately non-specific on failure. */
  error?: string;
  /** Present when the account is temporarily locked. */
  lockedUntil?: number;
}
