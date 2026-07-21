import clsx from 'clsx';
import type { PluginCategory } from '@open-factory/plugin-market';

// ─── Class name utility ──────────────────────────────────────────────

export function cn(...args: Parameters<typeof clsx>): string {
  return clsx(...args);
}

// ─── Number formatting ───────────────────────────────────────────────

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// ─── Category labels ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<PluginCategory, string> = {
  effect: 'Effect',
  transition: 'Transition',
  generator: 'Generator',
  analyzer: 'Analyzer',
  exporter: 'Exporter',
  importer: 'Importer',
  tool: 'Tool',
  workflow: 'Workflow',
  theme: 'Theme',
  other: 'Other',
};

export function categoryLabel(cat: PluginCategory): string {
  return CATEGORY_LABELS[cat];
}
