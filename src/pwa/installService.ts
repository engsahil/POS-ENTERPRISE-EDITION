/**
 * Installation support.
 *
 * Honesty rule for this module: an install button is only ever offered when
 * the browser has actually given us a usable install prompt. We never render
 * a button that would do nothing.
 *
 * Browser reality, which is why this is not a single boolean:
 *
 *   Chrome / Edge / Samsung (desktop + Android)
 *       Fire `beforeinstallprompt`. We capture the event and can trigger the
 *       real install flow on demand. -> `promptable`
 *
 *   Safari (iOS + iPadOS)
 *       No prompt event and no programmatic install. The user must use
 *       Share -> Add to Home Screen. -> `manual-ios`
 *
 *   Firefox desktop, and anything else
 *       No install flow at all. -> `unsupported`
 *
 *   Already running installed
 *       -> `installed`
 */

export type InstallAvailability =
  | 'installed'
  | 'promptable'
  | 'manual-ios'
  | 'unsupported'
  | 'pending';

export interface InstallState {
  availability: InstallAvailability;
  /** True when the app is running in a standalone window. */
  standalone: boolean;
  /** Result of the most recent prompt, if one has been shown. */
  lastOutcome: 'accepted' | 'dismissed' | null;
}

/** The captured event. Chromium-only; typed locally to avoid a lib dependency. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Listener = (state: InstallState) => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<Listener>();

/** True when running as an installed app rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  const displayModes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
  const matched = displayModes.some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  );

  // iOS Safari predates display-mode and exposes its own flag.
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true;

  return matched || iosStandalone;
}

/** iOS Safari, where installation is manual via the Share sheet. */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as a Mac; touch points disambiguate it.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Exclude in-app browsers and Chrome on iOS, which cannot install either.
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  return isIos && isSafari;
}

let state: InstallState = {
  availability: 'pending',
  standalone: false,
  lastOutcome: null,
};

function publish(next: Partial<InstallState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener(state);
}

/** Work out what, if anything, we can honestly offer. */
function evaluate(): InstallAvailability {
  if (isStandalone()) return 'installed';
  if (deferredPrompt) return 'promptable';
  if (isIosSafari()) return 'manual-ios';

  /*
   * Chromium fires beforeinstallprompt asynchronously and only once its
   * own criteria are met, so the absence of the event early on does not
   * prove the browser cannot install. Report `pending` until we know.
   */
  if (typeof window !== 'undefined' && 'onbeforeinstallprompt' in window) {
    return 'pending';
  }

  return 'unsupported';
}

export const installService = {
  getState(): InstallState {
    return state;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  },

  /** Begin listening. Safe to call once at startup. */
  start(): void {
    if (typeof window === 'undefined') return;

    publish({ standalone: isStandalone(), availability: evaluate() });

    window.addEventListener('beforeinstallprompt', (event) => {
      // Suppress the browser's own mini-infobar so the app can offer
      // installation at a sensible moment instead.
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      publish({ availability: 'promptable' });
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      publish({ availability: 'installed', lastOutcome: 'accepted' });
    });

    // Display mode can change without a reload (e.g. installing from a tab).
    for (const mode of ['standalone', 'fullscreen', 'minimal-ui']) {
      window
        .matchMedia(`(display-mode: ${mode})`)
        .addEventListener('change', () => {
          publish({ standalone: isStandalone(), availability: evaluate() });
        });
    }

    /*
     * If no prompt has arrived after a grace period, stop reporting
     * `pending`: either the browser cannot install, or the app is already
     * installed. Either way we must not leave a button in limbo.
     */
    window.setTimeout(() => {
      if (state.availability === 'pending') {
        publish({ availability: isIosSafari() ? 'manual-ios' : 'unsupported' });
      }
    }, 3000);
  },

  /**
   * Show the browser's install prompt.
   * Only callable when availability is 'promptable'.
   */
  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferredPrompt) return 'unavailable';

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      // The event can only be used once.
      deferredPrompt = null;
      publish({
        lastOutcome: outcome,
        availability: outcome === 'accepted' ? 'installed' : evaluate(),
      });
      return outcome;
    } catch {
      deferredPrompt = null;
      publish({ availability: evaluate() });
      return 'unavailable';
    }
  },
};
