'use client';

import type { PluginCategory } from '@open-factory/plugin-market';

interface CategoryMeta {
  readonly id: PluginCategory | 'all';
  readonly name: string;
  readonly icon: string;
  readonly count: number;
}

interface CategoryNavProps {
  readonly categories: readonly CategoryMeta[];
  readonly activeCategory?: PluginCategory;
  readonly onSelect?: (id: PluginCategory | 'all') => void;
}

export function CategoryNav({
  categories,
  activeCategory,
  onSelect,
}: CategoryNavProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((cat) => {
        const isActive =
          cat.id === 'all'
            ? activeCategory === undefined
            : activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect?.(cat.id)}
            className={`
              flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium
              transition-all
              ${
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-sm shadow-[rgba(var(--accent-rgb),0.2)]'
                  : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
              }
            `}
          >
            <span className="text-sm">{cat.icon}</span>
            <span>{cat.name}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-2xs font-mono ${
                isActive
                  ? 'bg-white/15 text-white/80'
                  : 'bg-[var(--surface-3)] text-[var(--text-tertiary)]'
              }`}
            >
              {cat.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
