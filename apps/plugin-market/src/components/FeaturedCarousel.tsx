'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PluginRegistryEntry } from '@open-factory/plugin-market';
import { RatingStars } from './RatingStars';
import { formatNumber } from '@/lib/utils';

interface FeaturedCarouselProps {
  readonly plugins: readonly PluginRegistryEntry[];
}

export function FeaturedCarousel({ plugins }: FeaturedCarouselProps) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(
    () => setCurrent((i) => (i + 1) % plugins.length),
    [plugins.length],
  );
  const prev = useCallback(
    () => setCurrent((i) => (i - 1 + plugins.length) % plugins.length),
    [plugins.length],
  );

  // Auto-advance every 6s
  useEffect(() => {
    if (plugins.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [plugins.length, next]);

  if (plugins.length === 0) return null;

  const plugin = plugins[current];
  const { manifest, stats, rating } = plugin;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-1)]">
      <div className="flex flex-col md:flex-row">
        {/* Content side */}
        <div className="flex-1 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-2xl">
              {manifest.icon || '🔌'}
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">
                {manifest.name}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                by {manifest.author}
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--text-secondary)]">
            {manifest.description}
          </p>

          <div className="mt-4 flex items-center gap-4">
            <RatingStars rating={rating.averageRating} showValue />
            <span className="text-xs text-[var(--text-tertiary)]">
              {formatNumber(stats.activeInstalls)} active installs
            </span>
          </div>

          <a
            href={`/plugins/${manifest.id}`}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            View Details
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </a>
        </div>

        {/* Decorative side */}
        <div className="hidden h-full w-64 items-center justify-center bg-gradient-to-br from-indigo-500/10 to-purple-600/5 md:flex">
          <span className="text-6xl opacity-80">{manifest.icon || '✨'}</span>
        </div>
      </div>

      {/* Navigation dots */}
      {plugins.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {plugins.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-6 bg-[var(--accent)]'
                  : 'w-1.5 bg-[var(--text-tertiary)] hover:bg-[var(--text-secondary)]'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Arrow buttons */}
      {plugins.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
            style={{ backgroundColor: 'rgba(22, 22, 34, 0.8)' }}
            aria-label="Previous"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
            style={{ backgroundColor: 'rgba(22, 22, 34, 0.8)' }}
            aria-label="Next"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
