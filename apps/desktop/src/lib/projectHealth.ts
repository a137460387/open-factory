import { runProjectHealthCheck, type Project, type ProjectHealthReport, type ProxySettings } from '@open-factory/editor-core';
import { isFontFamilyAvailable } from './fonts';
import { isTauriRuntime } from './tauri';
import { fsExists, getTauriMocks } from './tauri-bridge';

export async function scanProjectHealth(project: Project, proxySettings?: ProxySettings): Promise<ProjectHealthReport> {
  const missingMediaAssetIds = new Set<string>();
  const canCheckNativeFiles = isTauriRuntime() || Boolean(getTauriMocks());
  if (canCheckNativeFiles) {
    await Promise.all(
      project.media.map(async (asset) => {
        if (asset.missing || !asset.path.trim()) {
          missingMediaAssetIds.add(asset.id);
          return;
        }
        const paths = asset.imageSequence?.paths.length ? asset.imageSequence.paths : [asset.path];
        const checks = await Promise.all(paths.map((path) => fsExists(path).catch(() => false)));
        if (checks.some((exists) => !exists)) {
          missingMediaAssetIds.add(asset.id);
        }
      })
    );
  }
  return runProjectHealthCheck(project, {
    missingMediaAssetIds,
    isFontFamilyAvailable,
    proxySettings
  });
}
