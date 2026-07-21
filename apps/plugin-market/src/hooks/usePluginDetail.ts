'use client';

import { useState, useEffect, useRef } from 'react';
import type {
  PluginRegistryEntry,
  PluginReview,
  PluginVersionInfo,
} from '@open-factory/plugin-market';

interface PluginDetailData {
  readonly plugin: PluginRegistryEntry;
  readonly reviews: readonly PluginReview[];
  readonly versions: readonly PluginVersionInfo[];
}

interface UsePluginDetailReturn {
  readonly data: PluginDetailData | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export function usePluginDetail(id: string): UsePluginDetailReturn {
  const [data, setData] = useState<PluginDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(`/api/plugins/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Plugin not found');
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<PluginDetailData>;
      })
      .then((json) => {
        if (!controller.signal.aborted) {
          setData(json);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Failed to load plugin';
        if (!controller.signal.aborted) {
          setError(message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [id]);

  return { data, loading, error };
}
