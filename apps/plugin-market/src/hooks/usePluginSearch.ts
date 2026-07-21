'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  PluginSearchQuery,
  PluginSearchResponse,
  PluginCategory,
} from '@open-factory/plugin-market';

interface UsePluginSearchOptions {
  readonly initialKeyword?: string;
  readonly initialCategory?: PluginCategory;
  readonly initialSortBy?: PluginSearchQuery['sortBy'];
  readonly limit?: number;
}

interface UsePluginSearchReturn {
  readonly data: PluginSearchResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly keyword: string;
  readonly category: PluginCategory | undefined;
  readonly sortBy: PluginSearchQuery['sortBy'];
  readonly page: number;
  readonly setKeyword: (kw: string) => void;
  readonly setCategory: (cat: PluginCategory | undefined) => void;
  readonly setSortBy: (sort: PluginSearchQuery['sortBy']) => void;
  readonly setPage: (p: number) => void;
  readonly refresh: () => void;
}

export function usePluginSearch(
  opts: UsePluginSearchOptions = {},
): UsePluginSearchReturn {
  const {
    initialKeyword = '',
    initialCategory,
    initialSortBy = 'relevance',
    limit = 12,
  } = opts;

  const [keyword, setKeyword] = useState(initialKeyword);
  const [category, setCategory] = useState<PluginCategory | undefined>(initialCategory);
  const [sortBy, setSortBy] = useState<PluginSearchQuery['sortBy']>(initialSortBy);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PluginSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback(async () => {
    // Cancel previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (keyword) params.set('keyword', keyword);
      if (category) params.set('category', category);
      if (sortBy) params.set('sortBy', sortBy);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/plugins?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json: PluginSearchResponse = await res.json();
      if (!controller.signal.aborted) {
        setData(json);
      }
    } catch (err: unknown) {
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
  }, [keyword, category, sortBy, page, limit]);

  // Reset page when search params change
  const prevKeywordRef = useRef(keyword);
  const prevCategoryRef = useRef(category);
  const prevSortByRef = useRef(sortBy);

  useEffect(() => {
    if (
      keyword !== prevKeywordRef.current ||
      category !== prevCategoryRef.current ||
      sortBy !== prevSortByRef.current
    ) {
      prevKeywordRef.current = keyword;
      prevCategoryRef.current = category;
      prevSortByRef.current = sortBy;
      setPage(1);
    }
  }, [keyword, category, sortBy]);

  useEffect(() => {
    fetchResults();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchResults]);

  return {
    data,
    loading,
    error,
    keyword,
    category,
    sortBy,
    page,
    setKeyword,
    setCategory,
    setSortBy,
    setPage,
    refresh: fetchResults,
  };
}
