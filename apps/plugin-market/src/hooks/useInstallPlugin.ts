'use client';

import { useState, useCallback } from 'react';

type InstallState = 'idle' | 'confirming' | 'installing' | 'success' | 'error';

interface UseInstallPluginReturn {
  readonly state: InstallState;
  readonly progress: number;
  readonly error: string | null;
  readonly startInstall: () => void;
  readonly confirmInstall: () => void;
  readonly cancelInstall: () => void;
  readonly reset: () => void;
}

interface UseInstallPluginOptions {
  readonly hasPermissions: boolean;
  readonly onComplete?: () => void;
}

export function useInstallPlugin(
  opts: UseInstallPluginOptions,
): UseInstallPluginReturn {
  const { hasPermissions, onComplete } = opts;
  const [state, setState] = useState<InstallState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const simulateInstall = useCallback(async () => {
    setState('installing');
    setProgress(0);
    setError(null);

    try {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((r) => setTimeout(r, 150));
        setProgress(i);
      }
      setState('success');
      onComplete?.();
    } catch {
      setState('error');
      setError('Installation failed. Please try again.');
    }
  }, [onComplete]);

  const startInstall = useCallback(() => {
    if (hasPermissions) {
      setState('confirming');
    } else {
      simulateInstall();
    }
  }, [hasPermissions, simulateInstall]);

  const confirmInstall = useCallback(() => {
    simulateInstall();
  }, [simulateInstall]);

  const cancelInstall = useCallback(() => {
    setState('idle');
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setError(null);
  }, []);

  return {
    state,
    progress,
    error,
    startInstall,
    confirmInstall,
    cancelInstall,
    reset,
  };
}
