import { useCallback } from 'react';
import { MigrateProxiesCommand, getProjectFrameRateConversionTarget, getCfrTargetFrameRate, buildProxyMigration } from '@open-factory/editor-core';
import { showToast } from '../lib/toast';
import { zhCN } from '../i18n/strings';
import { commandManager, projectAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { createProxyForAsset, type ProxyGenerationOptions } from '../media/proxy';
import { moveFile, removeFile } from '../lib/tauri-bridge';

// ---------------------------------------------------------------------------
// 参数接口：Proxy Management 回调组
// ---------------------------------------------------------------------------

interface ProxyCallbacksDeps {
  /** 代理设置 */
  proxySettings: ReturnType<typeof useProxySettingsStore.getState>['settings'];
  /** 项目 fps */
  projectFps: number;
}

/** 代理管理相关的回调组 */
export function useProxyCallbacks(deps: ProxyCallbacksDeps) {
  const { proxySettings, projectFps } = deps;

  const setMedia = useEditorStore((state) => state.setMedia);

  const generateProxyForMedia = useCallback(
    async (assetId: string, options: ProxyGenerationOptions = {}) => {
      const asset = useEditorStore.getState().project.media.find((item) => item.id === assetId);
      if (!asset || asset.type !== 'video') {
        return;
      }
      setMedia(useEditorStore.getState().project.media.map((item) => (item.id === assetId ? { ...item, proxyStatus: 'pending', proxyError: undefined } : item)));
      try {
        const proxyAsset = await createProxyForAsset({ ...asset, proxyStatus: 'pending', proxyError: undefined }, proxySettings, options);
        setMedia(useEditorStore.getState().project.media.map((item) => (item.id === assetId ? proxyAsset : item)));
        showToast({ kind: 'success', title: zhCN.editorToasts.proxyReady, message: proxyAsset.name });
      } catch (error) {
        setMedia(
          useEditorStore
            .getState()
            .project.media.map((item) =>
              item.id === assetId
                ? { ...item, proxyStatus: 'error', proxyError: error instanceof Error ? error.message : zhCN.editorToasts.proxyFailedMessage }
                : item
            )
        );
        showToast({ kind: 'error', title: zhCN.editorToasts.proxyFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.proxyFailedMessage });
      }
    },
    [proxySettings, setMedia]
  );

  const deleteProxiesForMedia = useCallback(
    async (assetIds: string[]) => {
      const ids = new Set(assetIds);
      const media = useEditorStore.getState().project.media;
      const proxyPaths = media.filter((asset) => ids.has(asset.id) && asset.proxyPath).map((asset) => asset.proxyPath!);
      try {
        await Promise.all(proxyPaths.map((path) => removeFile(path).catch(() => undefined)));
        setMedia(
          useEditorStore.getState().project.media.map((asset) =>
            ids.has(asset.id)
              ? {
                  ...asset,
                  proxyPath: undefined,
                  proxyStatus: asset.type === 'video' ? 'none' : undefined,
                  proxyError: undefined
                }
              : asset
          )
        );
        showToast({ kind: 'success', title: zhCN.editorToasts.proxyDeleted, message: zhCN.editorToasts.proxyDeletedMessage(proxyPaths.length) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.proxyDeleteFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.proxyDeleteFailedMessage });
      }
    },
    [setMedia]
  );

  const regenerateProxiesForMedia = useCallback(
    async (assetIds: string[]) => {
      for (const assetId of assetIds) {
        await generateProxyForMedia(assetId, { force: true });
      }
    },
    [generateProxyForMedia]
  );

  const migrateProxiesToDirectory = useCallback(async (targetDirectory: string) => {
    const updates = buildProxyMigration(useEditorStore.getState().project.media, targetDirectory);
    if (updates.length === 0) {
      showToast({ kind: 'info', title: zhCN.editorToasts.proxyMigrationSkipped });
      return;
    }
      const moved: typeof updates = [];
    try {
      for (const update of updates) {
        await moveFile(update.fromPath, update.toPath);
        moved.push(update);
      }
      commandManager.execute(new MigrateProxiesCommand(projectAccessor, updates));
      showToast({ kind: 'success', title: zhCN.editorToasts.proxyMigrated, message: zhCN.editorToasts.proxyMigratedMessage(updates.length) });
    } catch (error) {
      for (const update of moved.reverse()) {
        await moveFile(update.toPath, update.fromPath).catch(() => undefined);
      }
      showToast({ kind: 'error', title: zhCN.editorToasts.proxyMigrationFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.proxyMigrationFailedMessage });
    }
  }, []);

  const convertVfrMediaToCfr = useCallback(
    (assetId: string) => {
      const asset = useEditorStore.getState().project.media.find((item) => item.id === assetId);
      if (!asset || asset.type !== 'video') {
        return;
      }
      const cfrFrameRate = getProjectFrameRateConversionTarget(projectFps, getCfrTargetFrameRate({ avgFrameRate: asset.avgFrameRate, realFrameRate: asset.realFrameRate }, asset.frameRate ?? 30));
      void generateProxyForMedia(assetId, { force: true, cfrFrameRate });
    },
    [generateProxyForMedia, projectFps]
  );

  return {
    generateProxyForMedia,
    deleteProxiesForMedia,
    regenerateProxiesForMedia,
    migrateProxiesToDirectory,
    convertVfrMediaToCfr,
  };
}
