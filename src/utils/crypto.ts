/**
 * Password hashing helpers built on the Web Crypto API — no dependencies.
 *
 * Passwords are never stored or logged in plaintext. We derive a PBKDF2-SHA256
 * key from the password plus a per-account random salt and persist only the
 * derived hash, the salt, and the parameters used to produce them.
 */

import { AUTH_CONFIG } from '@/config/auth.config';

export interface PasswordHash {
  /** Base64 derived key. */
  hash: string;
  /** Base64 salt. */
  salt: string;
  iterations: number;
  algorithm: 'PBKDF2-SHA256';
}

/**
 * Web Crypto's subtle API is only exposed in secure contexts (HTTPS or
 * localhost). We refuse to silently downgrade to a weak hash.
 */
export function isCryptoAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.deriveBits === 'function'
  );
}

function assertCrypto(): void {
  if (!isCryptoAvailable()) {
    throw new Error(
      'Secure crypto is unavailable. Serve the application over HTTPS or from localhost.',
    );
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    AUTH_CONFIG.keyBytes * 8,
  );

  return new Uint8Array(bits);
}

/** Hash a password with a fresh random salt. */
export async function hashPassword(password: string): Promise<PasswordHash> {
  assertCrypto();

  const salt = crypto.getRandomValues(new Uint8Array(AUTH_CONFIG.saltBytes));
  const iterations = AUTH_CONFIG.pbkdf2Iterations;
  const derived = await deriveBits(password, salt, iterations);

  return {
    hash: toBase64(derived),
    salt: toBase64(salt),
    iterations,
    algorithm: 'PBKDF2-SHA256',
  };
}

/**
 * Compare two byte arrays in constant time so a timing side-channel cannot
 * reveal how much of the hash matched.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] as number) ^ (b[i] as number);
  }
  return diff === 0;
}

/** Verify a candidate password against a stored hash. */
export async function verifyPassword(
  password: string,
  stored: PasswordHash,
): Promise<boolean> {
  assertCrypto();

  try {
    const salt = fromBase64(stored.salt);
    const derived = await deriveBits(password, salt, stored.iterations);
    return timingSafeEqual(derived, fromBase64(stored.hash));
  } catch {
    return false;
  }
}

/** Opaque random token used to identify a session. */
export function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replace(/[+/=]/g, '');
}

/**
 * SHA-256 of a token, hex encoded.
 *
 * Used to bind a stored session to the account record without keeping a
 * usable token in the database.
 */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
