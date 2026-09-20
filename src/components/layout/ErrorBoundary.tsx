import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertIcon } from '@/components/ui/Icons';
import { Button } from '@/components/ui';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Prevents a render error in any screen from blanking the whole terminal. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <div className={styles.wrapper} role="alert">
        <AlertIcon className={styles.icon} />
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.message}>
          The application hit an unexpected error. Your saved data is safe on
          this device.
        </p>
        {import.meta.env.DEV ? (
          <pre className={styles.details}>{error.message}</pre>
        ) : null}
        <Button onClick={this.handleReload}>Reload application</Button>
      </div>
    );
  }
}
