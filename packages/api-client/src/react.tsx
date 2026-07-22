/**
 * React hooks for Open Factory API
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  OpenFactoryApiClient,
  createApiClient,
  type ApiClientConfig,
  type PluginSearchResponse,
  type PluginDetail,
  type CreatorDashboardData,
  type CreatorProfile,
  type CreatorStats,
  type CreatorRevenue,
} from './index.js';

// ============================================================
// API Client Context
// ============================================================

let globalClient: OpenFactoryApiClient | null = null;

export function initializeApiClient(config: ApiClientConfig): OpenFactoryApiClient {
  globalClient = createApiClient(config);
  return globalClient;
}

export function getApiClient(): OpenFactoryApiClient {
  if (!globalClient) {
    throw new Error('API client not initialized. Call initializeApiClient first.');
  }
  return globalClient;
}

// ============================================================
// Plugin Hooks
// ============================================================

interface UsePluginSearchOptions {
  keyword?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  enabled?: boolean;
}

interface UsePluginSearchReturn {
  data: PluginSearchResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePluginSearch(options: UsePluginSearchOptions = {}): UsePluginSearchReturn {
  const { enabled = true, ...params } = options;
  const [data, setData] = useState<PluginSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const client = getApiClient();
      const result = await client.searchPlugins(params);

      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Search failed';
      if (!controller.signal.aborted) {
        setError(message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [enabled, params.keyword, params.category, params.sortBy, params.sortOrder, params.page, params.limit]);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

interface UsePluginDetailReturn {
  data: PluginDetail | null;
  loading: boolean;
  error: string | null;
}

export function usePluginDetail(id: string): UsePluginDetailReturn {
  const [data, setData] = useState<PluginDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const client = getApiClient();
        const result = await client.getPlugin(id);

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Failed to load plugin';
        if (!controller.signal.aborted) {
          setError(message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [id]);

  return { data, loading, error };
}

// ============================================================
// Creator Hooks
// ============================================================

interface UseCreatorDashboardReturn {
  data: CreatorDashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCreatorDashboard(): UseCreatorDashboardReturn {
  const [data, setData] = useState<CreatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const client = getApiClient();
      const result = await client.getDashboard();

      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      if (!controller.signal.aborted) {
        setError(message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

interface UseCreatorProfileReturn {
  data: CreatorProfile | null;
  loading: boolean;
  error: string | null;
  update: (updates: Partial<CreatorProfile>) => Promise<void>;
}

export function useCreatorProfile(): UseCreatorProfileReturn {
  const [data, setData] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const client = getApiClient();
        const result = await client.getMyProfile();
        setData(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load profile';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const update = useCallback(async (updates: Partial<CreatorProfile>) => {
    try {
      const client = getApiClient();
      const result = await client.updateProfile(updates);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      throw new Error(message);
    }
  }, []);

  return { data, loading, error, update };
}

interface UseCreatorStatsReturn {
  data: CreatorStats | null;
  loading: boolean;
  error: string | null;
}

export function useCreatorStats(): UseCreatorStatsReturn {
  const [data, setData] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const client = getApiClient();
        const result = await client.getMyStats();
        setData(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load stats';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}

interface UseCreatorRevenueReturn {
  data: CreatorRevenue | null;
  loading: boolean;
  error: string | null;
}

export function useCreatorRevenue(): UseCreatorRevenueReturn {
  const [data, setData] = useState<CreatorRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const client = getApiClient();
        const result = await client.getMyRevenue();
        setData(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load revenue';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}
