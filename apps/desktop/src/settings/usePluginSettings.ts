import {useState, useCallback} from 'react';
import {zhCN} from '../i18n/strings';
import {showToast} from '../lib/toast';
import {openFileDialog} from '../lib/tauri-bridge';
import {getPluginRegistrySnapshot, refreshPluginRegistry, setPluginEnabled, uninstallPlugin, type LoadedPlugin, type PluginRegistry} from '../plugins/plugin-manager';
import {installCatalogPlugin, installPluginFromFile, loadPluginCatalog, type PluginCatalogEntry, type PluginCatalogResult} from '../plugins/plugin-market';

export function usePluginSettings(t: {loadFailed: string; loadFailedMessage: string; installComplete: string; installFailed: string; installFailedMessage: string; catalogLoadFailedMessage: string; disabledTitle: string; enabledTitle: string; uninstallFailedMessage: string; fileInstallFilter: string}) {
  const [pluginRegistry, setPluginRegistry] = useState<PluginRegistry>();
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pluginsError, setPluginsError] = useState<string>();
  const [pluginCatalog, setPluginCatalog] = useState<PluginCatalogResult>();
  const [pluginCatalogLoading, setPluginCatalogLoading] = useState(false);
  const [pluginCatalogError, setPluginCatalogError] = useState<string>();
  const [installingPluginId, setInstallingPluginId] = useState<string>();

  const refreshPlugins = useCallback(async () => {
    try {
      setPluginsLoading(true);
      setPluginsError(undefined);
      setPluginRegistry(await refreshPluginRegistry());
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : t.loadFailedMessage;
      setPluginsError(message);
      showToast({kind: 'warning', title: t.loadFailed, message});
    } finally {
      setPluginsLoading(false);
    }
  }, [t.loadFailed, t.loadFailedMessage]);

  const refreshPluginCatalog = useCallback(async () => {
    try {
      setPluginCatalogLoading(true);
      setPluginCatalogError(undefined);
      setPluginCatalog(await loadPluginCatalog());
    } catch (catalogError) {
      const message = catalogError instanceof Error ? catalogError.message : t.catalogLoadFailedMessage;
      setPluginCatalogError(message);
    } finally {
      setPluginCatalogLoading(false);
    }
  }, [t.catalogLoadFailedMessage]);

  const showCurrentPlugins = useCallback(() => {
    const snapshot = getPluginRegistrySnapshot();
    if (snapshot) {
      setPluginsError(undefined);
      setPluginRegistry(snapshot);
      return;
    }
    void refreshPlugins();
  }, [refreshPlugins]);

  const installMarketPlugin = useCallback(async (entry: PluginCatalogEntry) => {
    try {
      setInstallingPluginId(entry.id);
      setPluginsError(undefined);
      await installCatalogPlugin(entry);
      setPluginRegistry(await refreshPluginRegistry());
      showToast({kind: 'info', title: t.installComplete, message: entry.name});
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : t.installFailedMessage;
      setPluginsError(message);
      showToast({kind: 'warning', title: t.installFailed, message});
    } finally {
      setInstallingPluginId(undefined);
    }
  }, [t.installComplete, t.installFailed, t.installFailedMessage]);

  const installPluginFile = useCallback(async () => {
    try {
      const paths = await openFileDialog(false, [{name: t.fileInstallFilter, extensions: ['js']}]);
      const sourcePath = paths[0];
      if (!sourcePath) return;
      setPluginsError(undefined);
      await installPluginFromFile(sourcePath);
      setPluginRegistry(await refreshPluginRegistry());
      showToast({kind: 'info', title: t.installComplete, message: sourcePath});
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : t.installFailedMessage;
      setPluginsError(message);
      showToast({kind: 'warning', title: t.installFailed, message});
    }
  }, [t.fileInstallFilter, t.installComplete, t.installFailed, t.installFailedMessage]);

  const togglePlugin = useCallback(async (entry: LoadedPlugin) => {
    try {
      const nextRegistry = setPluginEnabled(entry.plugin.id, !entry.enabled);
      setPluginRegistry(nextRegistry ?? (await refreshPluginRegistry()));
      showToast({
        kind: 'info',
        title: entry.enabled ? t.disabledTitle : t.enabledTitle,
        message: entry.plugin.name,
      });
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : t.loadFailedMessage;
      setPluginsError(message);
      showToast({kind: 'warning', title: t.loadFailed, message});
    }
  }, [t.disabledTitle, t.enabledTitle, t.loadFailed, t.loadFailedMessage]);

  const removePlugin = useCallback(async (entry: LoadedPlugin) => {
    try {
      setPluginsLoading(true);
      setPluginsError(undefined);
      setPluginRegistry(await uninstallPlugin(entry.sourcePath));
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : t.uninstallFailedMessage;
      setPluginsError(message);
      showToast({kind: 'warning', title: t.loadFailed, message});
    } finally {
      setPluginsLoading(false);
    }
  }, [t.loadFailed, t.uninstallFailedMessage]);

  return {
    pluginRegistry,
    pluginsLoading,
    pluginsError,
    pluginCatalog,
    pluginCatalogLoading,
    pluginCatalogError,
    installingPluginId,
    refreshPlugins,
    refreshPluginCatalog,
    showCurrentPlugins,
    installMarketPlugin,
    installPluginFile,
    togglePlugin,
    removePlugin,
  };
}
