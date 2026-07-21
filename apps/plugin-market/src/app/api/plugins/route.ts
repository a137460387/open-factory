import { NextRequest, NextResponse } from 'next/server';
import type {
  PluginSearchQuery,
  PluginSearchResponse,
  PluginSearchResult,
  PluginCategory,
  PluginSortField,
} from '@open-factory/plugin-market';
import { mockPlugins } from '@/lib/mock-data';

const VALID_CATEGORIES: readonly PluginCategory[] = [
  'effect', 'transition', 'generator', 'analyzer', 'exporter',
  'importer', 'tool', 'workflow', 'theme', 'other',
];

const VALID_SORT_FIELDS: readonly PluginSortField[] = [
  'relevance', 'downloads', 'rating', 'updated', 'created', 'name',
];

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const keyword = sp.get('keyword') ?? undefined;
  const categoryParam = sp.get('category') ?? undefined;
  const sortByParam = (sp.get('sortBy') ?? 'relevance') as PluginSortField;
  const sortOrder = (sp.get('sortOrder') ?? 'desc') as 'asc' | 'desc';
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') ?? '12', 10)));

  const category =
    categoryParam && VALID_CATEGORIES.includes(categoryParam as PluginCategory)
      ? (categoryParam as PluginCategory)
      : undefined;

  const sortBy = VALID_SORT_FIELDS.includes(sortByParam) ? sortByParam : 'relevance';

  // Filter
  let filtered = [...mockPlugins];

  if (keyword) {
    const lower = keyword.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.manifest.name.toLowerCase().includes(lower) ||
        p.manifest.description.toLowerCase().includes(lower) ||
        p.manifest.keywords.some((k) => k.toLowerCase().includes(lower)),
    );
  }

  if (category) {
    filtered = filtered.filter((p) => p.manifest.category === category);
  }

  // Sort
  filtered.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'downloads':
        cmp = a.stats.downloads - b.stats.downloads;
        break;
      case 'rating':
        cmp = a.rating.averageRating - b.rating.averageRating;
        break;
      case 'updated':
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case 'created':
        cmp = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        break;
      case 'name':
        cmp = a.manifest.name.localeCompare(b.manifest.name);
        break;
      default:
        // relevance — use downloads as proxy
        cmp = a.stats.downloads - b.stats.downloads;
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  // Paginate
  const total = filtered.length;
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  const results: PluginSearchResult[] = paged.map((plugin) => ({
    plugin,
    score: 1,
    matchedFields: keyword ? ['name', 'description'] : [],
  }));

  const response: PluginSearchResponse = {
    results,
    total,
    page,
    limit,
    hasMore: start + limit < total,
  };

  return NextResponse.json(response);
}
