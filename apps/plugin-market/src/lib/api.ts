import type {
  PluginRegistryEntry,
  PluginSearchQuery,
  PluginSearchResponse,
  PluginReview,
  PluginVersionInfo,
} from '@open-factory/plugin-market';

// ─── API client ──────────────────────────────────────────────────────

interface ApiError {
  readonly error: string;
  readonly status: number;
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const BASE_URL = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!res.ok) {
      const body: ApiError = await res.json();
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    const data: T = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, error: message };
  }
}

// ─── Public API functions ────────────────────────────────────────────

export async function searchPlugins(
  query: Partial<PluginSearchQuery>,
): Promise<ApiResult<PluginSearchResponse>> {
  const params = new URLSearchParams();
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.category) params.set('category', query.category);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 12));

  return request<PluginSearchResponse>(`/plugins?${params.toString()}`);
}

export async function getPluginDetail(
  id: string,
): Promise<ApiResult<{ plugin: PluginRegistryEntry; reviews: PluginReview[]; versions: PluginVersionInfo[] }>> {
  return request(`/plugins/${encodeURIComponent(id)}`);
}
