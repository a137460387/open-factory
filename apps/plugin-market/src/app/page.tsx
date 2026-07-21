'use client';

import { SearchBar } from '@/components/SearchBar';
import { CategoryNav } from '@/components/CategoryNav';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { TrendingList } from '@/components/TrendingList';
import { PluginGrid } from '@/components/PluginGrid';
import { usePluginSearch } from '@/hooks/usePluginSearch';
import { mockFeatured, mockCategories, mockPlugins } from '@/lib/mock-data';

export default function HomePage() {
  const search = usePluginSearch();

  // Use search results when active, otherwise show all plugins
  const plugins = search.data?.results.map((r) => r.plugin) ?? mockPlugins;
  const isSearching =
    search.keyword.length > 0 || search.category !== undefined;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] px-6 py-10 sm:px-10 sm:py-14">
        {/* Subtle gradient accent */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-20"
          style={{
            background:
              'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
          }}
        />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Extend Your Creative Power
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
          Browse {mockPlugins.length}+ plugins for effects, transitions,
          generators, and more
        </p>
        <div className="mt-6 max-w-2xl">
          <SearchBar
            value={search.keyword}
            onChange={search.setKeyword}
          />
        </div>
      </section>

      {/* Category nav — hidden when searching */}
      {!isSearching && (
        <section>
          <CategoryNav
            categories={mockCategories}
            activeCategory={search.category}
            onSelect={(id) =>
              search.setCategory(
                id === 'all' ? undefined : (id as Parameters<typeof search.setCategory>[0]),
              )
            }
          />
        </section>
      )}

      {/* Featured — hidden when searching */}
      {!isSearching && (
        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Featured Plugins
          </h2>
          <FeaturedCarousel plugins={mockFeatured} />
        </section>
      )}

      {/* Trending — hidden when searching */}
      {!isSearching && (
        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Trending This Week
          </h2>
          <TrendingList plugins={mockPlugins.slice(0, 5)} />
        </section>
      )}

      {/* Plugin grid — always visible */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            {isSearching
              ? `Search Results (${search.data?.total ?? 0})`
              : 'All Plugins'}
          </h2>
          {!isSearching && (
            <select
              value={search.sortBy}
              onChange={(e) =>
                search.setSortBy(
                  e.target.value as Parameters<typeof search.setSortBy>[0],
                )
              }
              className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="relevance">Relevance</option>
              <option value="downloads">Downloads</option>
              <option value="rating">Rating</option>
              <option value="updated">Updated</option>
              <option value="name">Name</option>
            </select>
          )}
        </div>

        {search.loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : search.error ? (
          <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 p-8 text-center">
            <p className="text-sm text-[var(--danger)]">{search.error}</p>
            <button
              onClick={search.refresh}
              className="mt-3 text-xs text-[var(--accent)] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : plugins.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-12 text-center">
            <p className="text-lg">No plugins found</p>
            <p className="mt-2 text-sm text-[var(--text-tertiary)]">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <PluginGrid plugins={plugins} />
        )}

        {/* Pagination */}
        {search.data && search.data.hasMore && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => search.setPage(search.page + 1)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-6 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
            >
              Load More
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
