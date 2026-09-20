/**
 * Authentication configuration.
 *
 * SECURITY NOTE
 *
 * A bundled application cannot keep a secret. Anything referenced here through
 * `import.meta.env` is inlined into the JavaScript that is served to the
 * browser, where anyone can read it. An audit confirmed the previous build
 * shipped the bootstrap password in plain text inside `dist/assets/index-*.js`.
 *
 * The fix is not to obfuscate it but to stop shipping one. On first run the
 * application now generates a random single-use setup password, shows it once
 * to whoever is installing the terminal, and requires it to be changed before
 * the till can be used. Nothing secret is embedded in the build.
 *
 * `VITE_ADMIN_PASSWORD` is still honoured for automated testing and for
 * controlled kiosk provisioning, but it is explicitly documented as insecure
 * and the UI warns when it is in use.
 */

const env = import.meta.env;

const DEFAULT_USERNAME = 'admin';

/**
 * A provisioning password supplied at build time.
 *
 * Empty in a normal build. When set, it is visible in the bundle - acceptable
 * only for test automation or a device that is provisioned and then has its
 * password changed immediately.
 */
const PROVISIONED_PASSWORD = (env.VITE_ADMIN_PASSWORD ?? '').trim();

/**
 * Generate a readable single-use setup password.
 *
 * Uses the CSPRNG, avoids ambiguous characters (0/O, 1/l/I) so it can be read
 * off a screen and typed without error, and is never persisted in plaintext -
 * only its PBKDF2 hash is stored.
 */
export function generateSetupPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const groups = 3;
  const perGroup = 4;

  const bytes = new Uint8Array(groups * perGroup);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Only reachable in a non-browser context; still avoids a fixed value.
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  const out: string[] = [];
  for (let g = 0; g < groups; g += 1) {
    out.push(chars.slice(g * perGroup, (g + 1) * perGroup).join(''));
  }
  return out.join('-');
}

export const AUTH_CONFIG = {
  /** Seed username for first run. */
  bootstrapUsername: (env.VITE_ADMIN_USERNAME ?? DEFAULT_USERNAME).trim(),

  /**
   * Build-time password, if one was provisioned. Empty means the application
   * generates a random setup password instead.
   */
  provisionedPassword: PROVISIONED_PASSWORD,

  /** True when a password was baked into the build, which is not secure. */
  usingProvisionedPassword: PROVISIONED_PASSWORD.length > 0,

  /** How long a signed-in session stays valid. */
  sessionDurationMs: 12 * 60 * 60 * 1000, // 12 hours

  /** Brute-force protection. */
  maxFailedAttempts: 5,
  lockoutDurationMs: 60 * 1000, // 1 minute

  /** Minimum length enforced when changing the password. */
  minPasswordLength: 6,

  /** PBKDF2 parameters. */
  pbkdf2Iterations: 150_000,
  saltBytes: 16,
  keyBytes: 32,
} as const;

/** Record id used for the admin credential document in the settings store. */
export const ADMIN_CREDENTIALS_ID = 'admin.credentials';
