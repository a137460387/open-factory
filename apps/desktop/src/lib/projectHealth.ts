import { logError } from '../lib/error-handlers';
import {
  buildProjectHealthSearchRoots,
  planMissingMediaAutoRelinks,
  runProjectHealthCheck,
  type MediaAsset,
  type Project,
  type ProjectHealthAutoRepairInput,
  type ProjectHealthReport,
  type ProxySettings,
} from '@open-factory/editor-core';
import { isFontFamilyAvailable } from './fonts';
import { inferAssetType, probeMediaPath } from './media';
import { isTauriRuntime } from './tauri';
import { fsExists, getTauriMocks, scanDirectory } from './tauri-bridge';

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
      }),
    );
  }
  return runProjectHealthCheck(project, {
    missingMediaAssetIds,
    isFontFamilyAvailable,
    proxySettings,
  });
}

export async function buildProjectHealthAutoRepairInput(
  project: Project,
  report: ProjectHealthReport,
): Promise<ProjectHealthAutoRepairInput> {
  const recentDirectories = Array.from(
    new Set(
      project.media.filter((asset) => !asset.missing && asset.path.trim()).map((asset) => directoryName(asset.path)),
    ),
  );
  const roots = buildProjectHealthSearchRoots(project, recentDirectories);
  const candidatePaths = Array.from(
    new Set(
      (
        await Promise.all(
          roots.map((root) => scanDirectory(root.path, root.kind === 'original' ? 1 : 2).catch(() => [])),
        )
      )
        .flat()
        .filter((path) => inferAssetType(path)),
    ),
  );
  const relinkPlan = planMissingMediaAutoRelinks(project, report, candidatePaths, roots);
  const relinkedAssets: Array<{ assetId: string; asset: MediaAsset }> = [];
  const manualEntries = [...relinkPlan.manualEntries];
  for (const replacement of relinkPlan.replacements) {
    const original = project.media.find((asset) => asset.id === replacement.assetId);
    if (!original) {
      manualEntries.push({
        type: 'missing-media',
        status: 'manual',
        assetId: replacement.assetId,
        message: `${replacement.assetId}: media record is missing`,
      });
      continue;
    }
    const probed = await probeMediaPath(replacement.candidatePath).catch(logError('projectHealth'));
    if (!probed || probed.type !== original.type) {
      manualEntries.push({
        type: 'missing-media',
        status: 'manual',
        assetId: original.id,
        message: `${original.name}: relink candidate type changed`,
      });
      continue;
    }
    relinkedAssets.push({ assetId: original.id, asset: mergeRelinkedAsset(original, probed) });
  }
  return {
    relinkedAssets,
    duplicateIssues: report.duplicateMedia,
    orphanAssetIds: report.orphanMedia.map((issue) => issue.assetId),
    proxyAssetIds: report.proxyMissing.map((issue) => issue.assetId),
    manualEntries,
  };
}

function mergeRelinkedAsset(original: MediaAsset, probed: MediaAsset): MediaAsset {
  return {
    ...probed,
    id: original.id,
    missing: false,
    originalAbsolutePath: original.originalAbsolutePath ?? original.path,
  };
}

function directoryName(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/\/+$/g, '');
  const index = normalized.lastIndexOf('/');
  if (index <= 0) {
    return normalized;
  }
  if (index === 2 && /^[a-zA-Z]:/.test(normalized)) {
    return normalized.slice(0, 3);
  }
  return normalized.slice(0, index);
}
