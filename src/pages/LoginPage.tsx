import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { authService } from '@/services/authService';
import { APP_CONFIG } from '@/config/app.config';
import { Button, Input, Spinner } from '@/components/ui';
import {
  AlertIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  UserIcon,
} from '@/components/ui/Icons';
import styles from './LoginPage.module.css';

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  /*
   * On a brand-new terminal the application generates a one-time setup
   * password rather than shipping a known one in the bundle. It is shown
   * here once so the installer can sign in.
   */
  const [setupPassword, setSetupPassword] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void authService.ensureBootstrapped().then(() => {
      if (active) setSetupPassword(authService.getSetupPassword());
    });
    return () => {
      active = false;
    };
  }, []);

  const { status, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const usernameRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  if (status === 'initialising') {
    return <Spinner fullscreen label="Checking session" />;
  }

  // Already signed in — bounce to wherever they were headed.
  if (isAuthenticated) {
    const target = (location.state as LocationState | null)?.from ?? '/';
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await login(username, password);

      if (!result.ok) {
        setError(result.error ?? 'Sign in failed.');
        setPassword('');
        setSubmitting(false);
        return;
      }

      const target = (location.state as LocationState | null)?.from ?? '/';
      navigate(target, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sign in failed. Please try again.',
      );
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.screen}>
      <main className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <path
                d="M5 8.5h14M5 8.5 6.5 18h11L19 8.5M5 8.5 7.5 5h9L19 8.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>
            Administrator access is required to use this terminal.
          </p>
        </div>

        {setupPassword ? (
          <div className={styles.setup} role="status">
            <p className={styles.setupTitle}>First-time setup</p>
            <p className={styles.setupBody}>
              Sign in with this one-time password, then set your own. It is
              shown only once and is not stored anywhere.
            </p>
            <p className={styles.setupCode} data-testid="setup-password">
              {setupPassword}
            </p>
          </div>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            ref={usernameRef}
            id="username"
            name="username"
            label="Username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            leadingIcon={<UserIcon />}
            disabled={submitting}
            fullWidth
          />

          <div className={styles.passwordField}>
            <Input
              id="password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leadingIcon={<LockIcon />}
              disabled={submitting}
              fullWidth
              className={styles.passwordInput}
            />
            <button
              type="button"
              className={styles.reveal}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOffIcon width={17} height={17} />
              ) : (
                <EyeIcon width={17} height={17} />
              )}
            </button>
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              <AlertIcon width={16} height={16} className={styles.errorIcon} />
              <span>{error}</span>
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={submitting}
            className={styles.submit}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </main>

      <p className={styles.version}>
        {APP_CONFIG.name} v{APP_CONFIG.version}
      </p>
    </div>
  );
}
