import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/app/AuthContext';
import { AUTH_CONFIG } from '@/config/auth.config';
import { authService } from '@/services/authService';
import styles from './SecuritySection.module.css';

type Errors = {
  current?: string;
  username?: string;
  password?: string;
  confirm?: string;
};

/**
 * Change the admin username and/or password.
 *
 * The current password is always required, so possession of an unlocked
 * terminal alone is not enough to take over the account.
 */
export function SecuritySection() {
  const { user, refresh } = useAuth();

  const [current, setCurrent] = useState('');
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const usernameChanged =
    username.trim() !== '' && username.trim() !== user?.username;
  const wantsPasswordChange = password !== '' || confirm !== '';
  const canSubmit = usernameChanged || wantsPasswordChange;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found: Errors = {};
    if (!current) found.current = 'Enter your current password.';

    if (usernameChanged && username.trim().length < 3) {
      found.username = 'Username must be at least 3 characters.';
    }

    if (wantsPasswordChange) {
      if (password.length < AUTH_CONFIG.minPasswordLength) {
        found.password = `Password must be at least ${AUTH_CONFIG.minPasswordLength} characters.`;
      } else if (password !== confirm) {
        found.confirm = 'Passwords do not match.';
      }
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setFailure(null);
    setDone(null);
    try {
      const result = await authService.changeCredentials({
        currentPassword: current,
        newUsername: usernameChanged ? username.trim() : undefined,
        newPassword: wantsPasswordChange ? password : undefined,
      });

      if (!result.ok) {
        setFailure(result.error ?? 'Could not update credentials.');
        return;
      }

      // Never leave secrets sitting in component state.
      setCurrent('');
      setPassword('');
      setConfirm('');
      setDone(
        usernameChanged && wantsPasswordChange
          ? 'Username and password updated.'
          : usernameChanged
            ? 'Username updated.'
            : 'Password updated.',
      );
      await refresh();
    } catch {
      setFailure('Could not update credentials. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {user?.mustChangePassword ? (
        <p className={styles.warn} role="status">
          This terminal is still using its one-time setup password. Set your
          own password below.
        </p>
      ) : null}

      <div className={styles.card}>
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Sign-in details</h3>

          <Input
            label="Username"
            name="adminUsername"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setErrors((p) => ({ ...p, username: undefined }));
              setDone(null);
            }}
            invalid={Boolean(errors.username)}
            hint={errors.username}
            autoComplete="username"
            fullWidth
          />

          <Input
            label="New password"
            name="adminNewPassword"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((p) => ({ ...p, password: undefined }));
              setDone(null);
            }}
            invalid={Boolean(errors.password)}
            hint={
              errors.password ??
              `Leave blank to keep the current password. Minimum ${AUTH_CONFIG.minPasswordLength} characters.`
            }
            autoComplete="new-password"
            fullWidth
          />

          <Input
            label="Confirm new password"
            name="adminConfirmPassword"
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setErrors((p) => ({ ...p, confirm: undefined }));
              setDone(null);
            }}
            invalid={Boolean(errors.confirm)}
            hint={errors.confirm}
            autoComplete="new-password"
            disabled={!wantsPasswordChange && password === ''}
            fullWidth
          />
        </div>

        <div className={styles.divider} />

        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Confirm it&apos;s you</h3>
          <Input
            label="Current password"
            name="adminCurrentPassword"
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setErrors((p) => ({ ...p, current: undefined }));
              setFailure(null);
            }}
            invalid={Boolean(errors.current)}
            hint={errors.current ?? 'Required for any change.'}
            autoComplete="current-password"
            fullWidth
          />
        </div>
      </div>

      {failure ? (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      ) : null}

      <div className={styles.actions}>
        <span className={styles.status} aria-live="polite">
          {done ? <span className={styles.done}>{done}</span> : null}
        </span>
        <Button type="submit" disabled={saving || !canSubmit}>
          {saving ? 'Saving' : 'Update credentials'}
        </Button>
      </div>
    </form>
  );
}
