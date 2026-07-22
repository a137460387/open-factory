import { Download, FilePlus } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import {
  type LoadedPlugin,
  type PluginRegistry,
} from '../plugins/plugin-manager';
import {
  getCatalogEntryInstallState,
  type PluginCatalogEntry,
  type PluginCatalogResult,
} from '../plugins/plugin-market';
import { getLoadedPluginStatus, type PluginPermission } from '../plugins/plugin-loader';

export function PluginsSettingsPanel({
  registry,
  loading,
  error,
  catalog,
  catalogLoading,
  catalogError,
  installingPluginId,
  onRefresh,
  onRefreshCatalog,
  onInstallCatalogPlugin,
  onInstallFromFile,
  onTogglePlugin,
  onUninstallPlugin,
}: {
  registry?: PluginRegistry;
  loading: boolean;
  error?: string;
  catalog?: PluginCatalogResult;
  catalogLoading: boolean;
  catalogError?: string;
  installingPluginId?: string;
  onRefresh(): void;
  onRefreshCatalog(): void;
  onInstallCatalogPlugin(entry: PluginCatalogEntry): void;
  onInstallFromFile(): void;
  onTogglePlugin(entry: LoadedPlugin): void;
  onUninstallPlugin(entry: LoadedPlugin): void;
}) {
  const t = zhCN.settings.plugins;
  const plugins = registry?.plugins ?? [];
  const catalogEntries = catalog?.entries ?? [];
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-panel p-3" data-testid="plugin-market-section">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">{t.marketTitle}</h3>
            <p className="text-xs text-slate-500">{t.marketDescription}</p>
            {catalog?.source === 'cache' ? (
              <p className="mt-1 text-[11px] font-medium text-amber-700" data-testid="plugin-market-cache-source">
                {t.catalogCacheSource}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
              type="button"
              data-testid="plugin-market-refresh-button"
              onClick={onRefreshCatalog}
            >
              <Download size={13} />
              {t.refreshCatalog}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
              type="button"
              data-testid="plugin-install-file-button"
              onClick={onInstallFromFile}
            >
              <FilePlus size={13} />
              {t.installFromFile}
            </button>
          </div>
        </div>
        {catalogLoading ? (
          <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">
            {t.catalogLoading}
          </div>
        ) : null}
        {catalogError ? (
          <div
            className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            data-testid="plugin-market-error"
          >
            {catalogError}
          </div>
        ) : null}
        {!catalogLoading && catalogEntries.length === 0 ? (
          <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">{t.catalogEmpty}</div>
        ) : null}
        <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="plugin-market-list">
          {catalogEntries.map((entry) => {
            const installState = getCatalogEntryInstallState(entry, registry);
            const installing = installingPluginId === entry.id;
            return (
              <div
                key={entry.id}
                className="rounded-md border border-line bg-white p-3"
                data-testid="plugin-market-card"
                data-plugin-id={entry.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{entry.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      {entry.author} · {entry.version}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {entry.description || t.noDescription}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded bg-panel px-2 py-1 text-[11px] font-semibold text-slate-600"
                    data-testid="plugin-market-install-state"
                  >
                    {t.installState[installState.status]}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {t.permissions}:{' '}
                  <span data-testid="plugin-market-permissions">{formatPluginPermissions(entry.permissions)}</span>
                </div>
                {installState.installedVersion ? (
                  <div className="mt-1 text-xs text-slate-500">{t.installedVersion(installState.installedVersion)}</div>
                ) : null}
                <button
                  className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md border border-line bg-panel px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={installing || installState.status === 'installed'}
                  data-testid="plugin-market-install-button"
                  onClick={() => onInstallCatalogPlugin(entry)}
                >
                  <Download size={13} />
                  {installing
                    ? t.installing
                    : installState.status === 'update-available'
                      ? t.update
                      : installState.status === 'installed'
                        ? t.installed
                        : t.install}
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
        </div>
        <button
          className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
          type="button"
          data-testid="plugins-refresh-button"
          onClick={onRefresh}
        >
          {t.refresh}
        </button>
      </div>
      {loading ? (
        <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.loading}</div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
      ) : null}
      {!loading && plugins.length === 0 ? (
        <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.empty}</div>
      ) : null}
      <div className="space-y-2">
        {plugins.map((entry) => {
          const status = getLoadedPluginStatus(entry);
          return (
            <div
              key={`${entry.sourcePath}-${entry.plugin.id}`}
              className="rounded-md border border-line bg-white p-3"
              data-testid="plugin-list-item"
              data-plugin-id={entry.plugin.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{entry.plugin.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {entry.plugin.id} · {entry.plugin.version}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {entry.plugin.description || t.noDescription}
                  </div>
                </div>
                <span className="rounded bg-panel px-2 py-1 text-[11px] font-semibold text-slate-600">
                  {entry.builtin ? t.builtin : t.user}
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-slate-500">
                <div>
                  {t.permissions}:{' '}
                  <span data-testid="plugin-permissions">{formatPluginPermissions(entry.plugin.permissions)}</span>
                </div>
                <div>
                  {t.hooks}: {Object.keys(entry.plugin.hooks).join(', ') || zhCN.common.none}
                </div>
                <div>
                  {t.status}:{' '}
                  <span
                    className={`font-semibold ${pluginStatusClass(status)}`}
                    data-testid="plugin-status"
                    data-status={status}
                  >
                    {t.state[status]}
                  </span>
                </div>
              </div>
              {entry.errors.length > 0 ? (
                <div className="mt-2 text-xs font-medium text-amber-700" data-testid="plugin-entry-error">
                  {t.errors}: {entry.errors.join('; ')}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-line bg-panel px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                  type="button"
                  data-testid="plugin-toggle-button"
                  onClick={() => onTogglePlugin(entry)}
                >
                  {entry.enabled ? t.disable : t.enable}
                </button>
                {!entry.builtin ? (
                  <button
                    className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                    type="button"
                    data-testid="plugin-uninstall-button"
                    onClick={() => onUninstallPlugin(entry)}
                  >
                    {t.uninstall}
                  </button>
                ) : (
                  <span className="rounded-md border border-line bg-panel px-2 py-1.5 text-xs font-medium text-slate-500">
                    {t.builtinLocked}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {registry?.errors.map((loadError) => (
        <div
          key={loadError.sourcePath}
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          data-testid="plugin-load-error"
        >
          <div className="font-semibold">{t.loadFailed}</div>
          <div className="break-all">
            {loadError.sourcePath}: {loadError.message}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatPluginPermissions(permissions: PluginPermission[]): string {
  return (
    permissions.map((permission) => zhCN.settings.plugins.permissionLabels[permission]).join(', ') || zhCN.common.none
  );
}

function pluginStatusClass(status: 'enabled' | 'disabled' | 'error'): string {
  if (status === 'enabled') {
    return 'text-emerald-700';
  }
  if (status === 'disabled') {
    return 'text-slate-600';
  }
  return 'text-amber-700';
}
