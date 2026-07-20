/**
 * Plugin Marketplace Panel
 *
 * Browse, search, install, and manage plugins from the marketplace.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  type MarketplacePlugin,
  type PluginCategory,
  type MarketplaceSearchResult,
} from '@open-factory/plugin-sdk';

// ─── Types ────────────────────────────────────────────

interface PluginCardProps {
  plugin: MarketplacePlugin;
  installed: boolean;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
}

interface MarketplacePanelProps {
  plugins: MarketplacePlugin[];
  installedIds: Set<string>;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  onSearch: (query: string, category?: PluginCategory) => MarketplaceSearchResult;
}

// ─── Plugin Card ────────────────────────────────────────────

function PluginCard({ plugin, installed, onInstall, onUninstall }: PluginCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{plugin.icon ?? '🧩'}</span>
          <div>
            <h3 className="font-medium text-sm">{plugin.name}</h3>
            <p className="text-xs text-muted-foreground">v{plugin.version} · {plugin.author}</p>
          </div>
        </div>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{plugin.category}</span>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">{plugin.description}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>⭐ {plugin.rating.toFixed(1)}</span>
        <span>📥 {plugin.downloads.toLocaleString()}</span>
      </div>
      <div className="flex gap-2 mt-auto pt-2">
        {installed ? (
          <Button variant="outline" size="sm" onClick={() => onUninstall(plugin.id)} className="flex-1">
            卸载
          </Button>
        ) : (
          <Button size="sm" onClick={() => onInstall(plugin.id)} className="flex-1">
            安装
          </Button>
        )}
        <Button variant="ghost" size="sm">
          详情
        </Button>
      </div>
    </div>
  );
}

// ─── Marketplace Panel ────────────────────────────────────────────

export function MarketplacePanel({
  plugins,
  installedIds,
  onInstall,
  onUninstall,
  onSearch,
}: MarketplacePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories: { value: string; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'ai-model', label: 'AI 模型' },
    { value: 'effect', label: '特效' },
    { value: 'template', label: '模板' },
    { value: 'transition', label: '转场' },
    { value: 'export', label: '导出' },
    { value: 'utility', label: '工具' },
    { value: 'integration', label: '集成' },
    { value: 'theme', label: '主题' },
  ];

  const filteredPlugins = useMemo(() => {
    const result = onSearch(
      searchQuery ?? '',
      activeCategory === 'all' ? undefined : (activeCategory as PluginCategory),
    );
    return result.plugins;
  }, [searchQuery, activeCategory, onSearch, plugins]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <h2 className="text-lg font-semibold">插件市场</h2>
        <div className="flex-1">
          <Input
            placeholder="搜索插件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      {/* Categories */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <div className="px-4 pt-2">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            {categories.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value} className="text-xs">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Plugin Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                installed={installedIds.has(plugin.id)}
                onInstall={onInstall}
                onUninstall={onUninstall}
              />
            ))}
          </div>
          {filteredPlugins.length === 0 && (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              没有找到匹配的插件
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}

// ─── Installed Plugins Tab ────────────────────────────────────────────

interface InstalledPluginsPanelProps {
  plugins: MarketplacePlugin[];
  installedIds: Set<string>;
  onUpdate: (id: string) => void;
  onUninstall: (id: string) => void;
  onToggle: (id: string) => void;
}

export function InstalledPluginsPanel({
  plugins,
  installedIds,
  onUpdate,
  onUninstall,
  onToggle,
}: InstalledPluginsPanelProps) {
  const installedPlugins = plugins.filter((p) => installedIds.has(p.id));

  if (installedPlugins.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        尚未安装任何插件
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {installedPlugins.map((plugin) => (
        <div
          key={plugin.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <span className="text-xl">{plugin.icon ?? '🧩'}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{plugin.name}</h3>
            <p className="text-xs text-muted-foreground">v{plugin.version}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onUpdate(plugin.id)}>
              更新
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onToggle(plugin.id)}>
              启用/禁用
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onUninstall(plugin.id)}>
              卸载
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
