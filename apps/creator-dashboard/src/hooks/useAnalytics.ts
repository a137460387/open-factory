import { useState, useEffect } from 'react';
import type { Analytics } from '@open-factory/creator-dashboard';
import { fetchAnalytics } from '@/lib/api';

interface UseAnalyticsResult {
  analytics: Analytics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAnalytics(creatorId: string): UseAnalyticsResult {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchAnalytics(creatorId);
    if (result.success && result.data) {
      setAnalytics(result.data);
    } else {
      setError(result.error ?? 'Failed to load analytics');
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [creatorId]);

  return { analytics, loading, error, refetch: load };
}
