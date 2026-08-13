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
