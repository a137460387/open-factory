'use client';

import type {
  PluginRegistryEntry,
  PluginReview,
  PluginVersionInfo,
} from '@open-factory/plugin-market';
import { RatingStars } from './RatingStars';
import { InstallButton } from './InstallButton';
import { VersionHistory } from './VersionHistory';
import { ReviewList } from './ReviewList';
import { ScreenshotGallery } from './ScreenshotGallery';
import { formatNumber, categoryLabel } from '@/lib/utils';

interface PluginDetailProps {
  readonly plugin: PluginRegistryEntry;
  readonly reviews: readonly PluginReview[];
  readonly versions: readonly PluginVersionInfo[];
}

export function PluginDetail({
  plugin,
  reviews,
  versions,
}: PluginDetailProps) {
  const { manifest, stats, rating, verified } = plugin;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <a
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
          />
        </svg>
        Back to Market
      </a>

      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--surface-3)] text-3xl">
            {manifest.icon || '🔌'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {manifest.name}
              </h1>
              {verified && (
                <span className="flex items-center gap-1 rounded-full bg-[rgba(var(--success-rgb),0.1)] px-2 py-0.5 text-2xs font-medium text-[var(--success)]">
                  <svg
                    className="h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-1.39-1.203 3 3 0 01-1.134-4.95 3 3 0 00-2.306-.47 3 3 0 01-2.084-2.084 3 3 0 00-.47-2.306 3 3 0 01-4.95-1.134 3 3 0 00-1.204-1.39 3 3 0 01-5.304 0 3 3 0 00-1.203 1.39 3 3 0 01-4.95 1.134 3 3 0 00-2.306.47 3 3 0 01-2.084 2.084 3 3 0 00-.47 2.306 3 3 0 01-1.134 4.95 3 3 0 00-1.39 1.203 3 3 0 010 5.304 3 3 0 001.39 1.203 3 3 0 011.134 4.95 3 3 0 00.47 2.306 3 3 0 012.084 2.084 3 3 0 002.306.47 3 3 0 014.95 1.134 3 3 0 001.203 1.39 3 3 0 015.304 0 3 3 0 001.203-1.39 3 3 0 014.95-1.134 3 3 0 002.306-.47 3 3 0 012.084-2.084 3 3 0 00.47-2.306 3 3 0 011.134-4.95 3 3 0 001.39-1.203zM6.72 15.34a.75.75 0 01-1.06-1.06l4.25-4.25a.75.75 0 011.06 0l2.25 2.25a.75.75 0 01-1.06 1.06L8.5 12.31l-1.78 1.03z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Verified
                </span>
              )}
              <span className="rounded bg-[var(--surface-3)] px-2 py-0.5 font-mono text-2xs text-[var(--text-tertiary)]">
                v{manifest.version}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              by {manifest.author}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <RatingStars rating={rating.averageRating} showValue />
              <span className="text-xs text-[var(--text-tertiary)]">
                {rating.totalReviews} reviews
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                {formatNumber(stats.activeInstalls)} installs
              </span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0">
          <InstallButton
            pluginId={manifest.id}
            pluginName={manifest.name}
            permissions={manifest.permissions.required.map(
              (p) => `${p.category}: ${p.target}`,
            )}
          />
        </div>
      </div>

      {/* Description */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
        <h2 className="text-sm font-semibold">Description</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
          {manifest.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {manifest.keywords.map((kw) => (
            <span
              key={kw}
              className="rounded bg-[var(--surface-3)] px-2 py-0.5 text-2xs text-[var(--text-tertiary)]"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* Screenshots */}
      {manifest.screenshots && manifest.screenshots.length > 0 && (
        <ScreenshotGallery screenshots={manifest.screenshots} />
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Downloads" value={formatNumber(stats.downloads)} />
        <StatCard
          label="Weekly"
          value={formatNumber(stats.weeklyDownloads)}
        />
        <StatCard
          label="Active"
          value={formatNumber(stats.activeInstalls)}
        />
        <StatCard label="Category" value={categoryLabel(manifest.category)} />
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Permissions */}
          {manifest.permissions.required.length > 0 && (
            <div className="rounded-xl border border-[rgba(var(--warning-rgb),0.2)] bg-[var(--surface-1)] p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <svg
                  className="h-4 w-4 text-[var(--warning)]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                Required Permissions
              </h2>
              <ul className="mt-3 space-y-2">
                {manifest.permissions.required.map((perm, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                  >
                    <span className="font-mono text-[var(--warning)]">
                      {perm.category}
                    </span>
                    <span className="text-[var(--text-tertiary)]">/</span>
                    <span className="font-mono">{perm.target}</span>
                    <span className="text-[var(--text-tertiary)]">
                      ({perm.operations.join(', ')})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reviews */}
          <ReviewList reviews={reviews} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <VersionHistory versions={versions} />

          {/* Info card */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5 space-y-3">
            <h3 className="text-sm font-semibold">Information</h3>
            <InfoRow label="Category" value={categoryLabel(manifest.category)} />
            <InfoRow label="License" value={manifest.license} />
            <InfoRow label="Min Host" value={manifest.minHostVersion} />
            {manifest.homepage && (
              <InfoRow
                label="Homepage"
                value={manifest.homepage}
                isLink
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Internal helpers ────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-3 text-center">
      <p className="text-lg font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-2xs text-[var(--text-tertiary)]">{label}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  isLink = false,
}: {
  label: string;
  value: string;
  isLink?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--text-tertiary)]">{label}</span>
      {isLink ? (
        <a
          href={value}
          className="text-[var(--accent)] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Link
        </a>
      ) : (
        <span className="text-[var(--text-secondary)]">{value}</span>
      )}
    </div>
  );
}
