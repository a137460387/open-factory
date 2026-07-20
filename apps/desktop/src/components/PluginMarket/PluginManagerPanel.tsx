import { useCallback } from 'react';
import type { LoadedPlugin } from '../../plugins/plugin-loader';
import { getLoadedPluginStatus } from '../../plugins/plugin-loader';

const permissionLabels: Record<string, string> = {
  'read-project': '读取项目',
  'write-project': '写入项目',
  'read-media': '读取媒体',
  'export-hook': '导出钩子',
  'menu-register': '菜单注册',
};

export interface PluginManagerPanelProps {
  /** Installed plugins. */
  plugins: LoadedPlugin[];
  /** Loading state. */
  loading?: boolean;
  /** Error message. */
  error?: string;
  /** Toggle plugin enabled state. */
  onToggle?: (pluginId: string, enabled: boolean) => void;
  /** Uninstall a plugin. */
  onUninstall?: (sourcePath: string) => void;
  /** Open plugin folder. */
  onOpenFolder?: (sourcePath: string) => void;
  /** Called when user requests refresh. */
  onRefresh?: () => void;
}

export function PluginManagerPanel({
  plugins,
  loading,
  error,
  onToggle,
  onUninstall,
  onOpenFolder,
  onRefresh,
}: PluginManagerPanelProps) {
  const handleToggle = useCallback(
    (pluginId: string, currentEnabled: boolean) => {
      onToggle?.(pluginId, !currentEnabled);
    },
    [onToggle],
  );

  return (
    <div className="flex h-full flex-col gap-3" data-testid="plugin-manager-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">已安装插件</h2>
        {onRefresh && (
          <button
            className="rounded-md border border-border px-3 py-1 text-xs transition-colors hover:bg-muted"
            onClick={onRefresh}
            disabled={loading}
            data-testid="plugin-manager-refresh"
          >
            {loading ? '刷新中…' : '刷新'}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && plugins.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">加载中…</div>
      ) : plugins.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="text-3xl">🧩</span>
          <p>暂无已安装插件</p>
          <p className="text-xs">前往插件市场浏览和安装插件</p>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-auto">
          {plugins.map((plugin) => {
            const status = getLoadedPluginStatus(plugin);
            return (
              <div
                key={plugin.plugin.id}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:border-border"
                data-testid={`installed-plugin-${plugin.plugin.id}`}
              >
                {/* Status indicator */}
                <div className="mt-1">
                  <button
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      status === 'enabled' ? 'bg-primary' : status === 'error' ? 'bg-destructive' : 'bg-muted'
                    }`}
                    onClick={() => handleToggle(plugin.plugin.id, plugin.enabled)}
                    disabled={plugin.builtin}
                    title={plugin.builtin ? '内置插件无法禁用' : plugin.enabled ? '点击禁用' : '点击启用'}
                    data-testid={`plugin-toggle-${plugin.plugin.id}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                        plugin.enabled ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Plugin info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium">{plugin.plugin.name}</h3>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      v{plugin.plugin.version}
                    </span>
                    {plugin.builtin && (
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        内置
                      </span>
                    )}
                    {plugin.dev && (
                      <span className="shrink-0 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning">
                        开发中
                      </span>
                    )}
                    {status === 'error' && (
                      <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                        错误
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {plugin.plugin.id}
                    {plugin.plugin.description && ` · ${plugin.plugin.description}`}
                  </p>

                  {/* Permissions */}
                  {plugin.plugin.permissions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {plugin.plugin.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="rounded-full border border-border/40 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {permissionLabels[perm] ?? perm}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Hooks */}
                  {Object.keys(plugin.plugin.hooks).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.keys(plugin.plugin.hooks).map((hook) => (
                        <span
                          key={hook}
                          className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {hook}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Error details */}
                  {status === 'error' && plugin.errors.length > 0 && (
                    <div className="mt-1.5 rounded bg-destructive/5 p-1.5 text-[10px] text-destructive">
                      {plugin.errors[0]}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {!plugin.builtin && onOpenFolder && (
                    <button
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="打开文件夹"
                      onClick={() => onOpenFolder(plugin.sourcePath)}
                    >
                      📁
                    </button>
                  )}
                  {!plugin.builtin && onUninstall && (
                    <button
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="卸载"
                      onClick={() => onUninstall(plugin.sourcePath)}
                      data-testid={`plugin-uninstall-${plugin.plugin.id}`}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
