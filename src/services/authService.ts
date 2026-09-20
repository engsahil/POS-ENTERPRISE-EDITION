/**
 * Authentication service.
 *
 * Owns credential bootstrap, verification, session lifecycle and credential
 * changes. Pure logic with no React dependency so it can be tested directly.
 *
 * Security notes:
 *  - Passwords are stored only as PBKDF2-SHA256 hashes with a per-account salt.
 *  - Login failures return a single generic message so the response cannot be
 *    used to enumerate valid usernames.
 *  - Repeated failures trigger a temporary lockout.
 */

import {
  ADMIN_CREDENTIALS_ID,
  AUTH_CONFIG,
  generateSetupPassword,
} from '@/config/auth.config';
import { adminRepository } from '@/data/repositories';
import { sessionStore } from '@/data/storage/sessionStore';
import type {
  AdminCredentials,
  AuthSession,
  AuthUser,
  LoginResult,
} from '@/types/auth';
import {
  createToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '@/utils/crypto';
import { nowISO } from '@/utils/date';

const GENERIC_FAILURE = 'Incorrect username or password.';

function toUser(record: AdminCredentials): AuthUser {
  return {
    username: record.username,
    role: 'admin',
    lastLoginAt: record.lastLoginAt ?? null,
    mustChangePassword: record.mustChangePassword,
  };
}

async function readCredentials(): Promise<AdminCredentials | undefined> {
  return adminRepository.getById(ADMIN_CREDENTIALS_ID);
}

/**
 * Create the admin account from the configured bootstrap credentials the
 * first time the app runs. Subsequent calls are a no-op, so changing the
 * env vars later never silently resets a live account.
 */
/**
 * The one-time setup password generated on first run, held in memory only.
 *
 * It is never written to storage in readable form and is discarded once the
 * page is closed. If the installer loses it before signing in, the terminal
 * data must be cleared and set up again - which is the correct trade-off for
 * not shipping a known password in the bundle.
 */
let pendingSetupPassword: string | null = null;

/** The setup password to display, or null once it has been used. */
export function getSetupPassword(): string | null {
  return pendingSetupPassword;
}

async function ensureBootstrapped(): Promise<AdminCredentials> {
  const existing = await readCredentials();
  if (existing) return existing;

  /*
   * No secret is embedded in the build. Unless a password was explicitly
   * provisioned at build time, generate a random one-time password and
   * require it to be changed at first sign-in.
   */
  const provisioned = AUTH_CONFIG.usingProvisionedPassword;
  const password = provisioned
    ? AUTH_CONFIG.provisionedPassword
    : generateSetupPassword();

  if (!provisioned) pendingSetupPassword = password;

  const record = await adminRepository.create({
    id: ADMIN_CREDENTIALS_ID,
    username: AUTH_CONFIG.bootstrapUsername,
    password: await hashPassword(password),
    role: 'admin',
    // Either way the operator must set their own password before trading.
    mustChangePassword: true,
    lastLoginAt: null,
  });

  return record;
}

function lockoutRemaining(): number {
  const { lockedUntil } = sessionStore.readAttempts();
  if (!lockedUntil) return 0;
  const remaining = lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

function registerFailure(): LoginResult {
  const attempts = sessionStore.readAttempts();
  const count = attempts.count + 1;

  if (count >= AUTH_CONFIG.maxFailedAttempts) {
    const lockedUntil = Date.now() + AUTH_CONFIG.lockoutDurationMs;
    sessionStore.writeAttempts({ count: 0, lockedUntil });
    return {
      ok: false,
      error: 'Too many failed attempts. Try again shortly.',
      lockedUntil,
    };
  }

  sessionStore.writeAttempts({ count, lockedUntil: null });
  return { ok: false, error: GENERIC_FAILURE };
}

/**
 * Mint a session and bind it to the account record.
 *
 * The token's hash is stored on the account, so a session object written by
 * hand into localStorage cannot be honoured: its token will not match.
 */
async function createSession(username: string): Promise<AuthSession> {
  const issuedAt = Date.now();
  const token = createToken();

  await adminRepository.update(ADMIN_CREDENTIALS_ID, {
    sessionTokenHash: await hashToken(token),
  } as Partial<AdminCredentials>);

  return {
    token,
    username,
    issuedAt,
    expiresAt: issuedAt + AUTH_CONFIG.sessionDurationMs,
  };
}

export const authService = {
  ensureBootstrapped,

  /** One-time setup password to display on first run, or null. */
  getSetupPassword,

  /** Milliseconds remaining on a lockout, or 0 when not locked. */
  lockoutRemaining,

  /** Resolve the current user from a stored, unexpired session. */
  async restore(): Promise<AuthUser | null> {
    const session = sessionStore.read();
    if (!session) return null;

    if (Date.now() >= session.expiresAt) {
      sessionStore.clear();
      return null;
    }

    const record = await readCredentials();
    if (!record) {
      sessionStore.clear();
      return null;
    }

    // Username changes invalidate an existing session.
    if (record.username !== session.username) {
      sessionStore.clear();
      return null;
    }

    /*
     * Verify the token against the hash bound to the account at sign-in.
     * Without this a session object written by hand into localStorage would
     * be accepted, granting admin access with no password - an authentication
     * bypass found during the security audit.
     */
    const expected = record.sessionTokenHash;
    if (!expected) {
      sessionStore.clear();
      return null;
    }

    const presented = await hashToken(session.token);
    if (presented !== expected) {
      sessionStore.clear();
      return null;
    }

    return toUser(record);
  },

  async login(username: string, password: string): Promise<LoginResult> {
    const remaining = lockoutRemaining();
    if (remaining > 0) {
      return {
        ok: false,
        error: 'Too many failed attempts. Try again shortly.',
        lockedUntil: Date.now() + remaining,
      };
    }

    const record = await ensureBootstrapped();

    const usernameMatches =
      record.username.toLowerCase() === username.trim().toLowerCase();
    const passwordMatches = await verifyPassword(password, record.password);

    // Both checks always run so timing does not reveal which one failed.
    if (!usernameMatches || !passwordMatches) {
      return registerFailure();
    }

    sessionStore.clearAttempts();
    sessionStore.write(await createSession(record.username));

    await adminRepository.update(record.id, { lastLoginAt: nowISO() });

    return { ok: true };
  },

  async logout(): Promise<void> {
    sessionStore.clear();
    // Invalidate the token so a copied session cannot be replayed later.
    try {
      await adminRepository.update(ADMIN_CREDENTIALS_ID, {
        sessionTokenHash: null,
      } as Partial<AdminCredentials>);
    } catch {
      /* the local session is already cleared; this is best effort */
    }
  },

  /** Current user, or null. Reads persisted state only. */
  async currentUser(): Promise<AuthUser | null> {
    return this.restore();
  },

  /**
   * Change username and/or password. Requires the current password.
   * Used by Admin settings.
   */
  async changeCredentials(input: {
    currentPassword: string;
    newUsername?: string;
    newPassword?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const record = await ensureBootstrapped();

    const valid = await verifyPassword(input.currentPassword, record.password);
    if (!valid) {
      return { ok: false, error: 'Current password is incorrect.' };
    }

    const nextUsername = input.newUsername?.trim() || record.username;
    if (nextUsername.length < 3) {
      return { ok: false, error: 'Username must be at least 3 characters.' };
    }

    let password = record.password;
    let mustChangePassword = record.mustChangePassword;

    if (input.newPassword) {
      if (input.newPassword.length < AUTH_CONFIG.minPasswordLength) {
        return {
          ok: false,
          error: `Password must be at least ${AUTH_CONFIG.minPasswordLength} characters.`,
        };
      }
      password = await hashPassword(input.newPassword);
      mustChangePassword = false;
    }

    await adminRepository.update(record.id, {
      username: nextUsername,
      password,
      mustChangePassword,
    });

    // The one-time setup password is spent.
    pendingSetupPassword = null;

    /*
     * A password change must not leave an old session usable. Re-bind the
     * current session so this device stays signed in while any other copy
     * of the previous token stops working.
     */
    const current = sessionStore.read();
    if (current) {
      const rebound = await createSession(nextUsername);
      sessionStore.write(rebound);
    }

    // Keep the active session valid under the new username.
    const session = sessionStore.read();
    if (session) {
      sessionStore.write({ ...session, username: nextUsername });
    }

    return { ok: true };
  },
};
