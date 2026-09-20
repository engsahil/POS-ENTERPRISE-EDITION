/**
 * Live installation state for the UI.
 *
 * Subscribes to installService so the UI reflects the browser's real
 * capability, including a prompt that arrives after first paint.
 */

import { useEffect, useState } from 'react';
import { installService, type InstallState } from '@/pwa/installService';

export function useInstallState(): InstallState {
  const [state, setState] = useState<InstallState>(() =>
    installService.getState(),
  );

  useEffect(() => installService.subscribe(setState), []);

  return state;
}
