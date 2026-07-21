import { useState, useEffect } from 'react';
import type { Creator, Plugin } from '@open-factory/creator-dashboard';
import { fetchCreator, fetchPlugins } from '@/lib/api';

interface UseCreatorResult {
  creator: Creator | null;
  plugins: Plugin[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCreator(creatorId: string): UseCreatorResult {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [creatorResult, pluginsResult] = await Promise.all([
      fetchCreator(creatorId),
      fetchPlugins(creatorId),
    ]);

    if (creatorResult.success && creatorResult.data) {
      setCreator(creatorResult.data);
    }
    if (pluginsResult.success && pluginsResult.data) {
      setPlugins(pluginsResult.data);
    }
    if (!creatorResult.success || !pluginsResult.success) {
      setError('Failed to load creator data');
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [creatorId]);

  return { creator, plugins, loading, error, refetch: load };
}
