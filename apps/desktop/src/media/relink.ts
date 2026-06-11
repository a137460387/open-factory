import { fileNameFromPath, planBatchRelinkByFileName, scoreRelinkCandidate, type MediaAsset } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { inferAssetType, probeMediaPath, VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, IMAGE_EXTENSIONS } from '../lib/media';
import { openDirectoryDialog, openFileDialog, scanDirectory } from '../lib/tauri-bridge';

const MEDIA_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS];

export interface RelinkFolderResult {
  media: MediaAsset[];
  relinkedCount: number;
  warnings: string[];
}

export async function relinkSingleMedia(asset: MediaAsset): Promise<MediaAsset | undefined> {
  const selected = await openFileDialog(false, [{ name: zhCN.fileDialogs.media, extensions: MEDIA_EXTENSIONS }]);
  const path = selected[0];
  if (!path) {
    return undefined;
  }
  const probed = await probeMediaPath(path);
  const score = scoreRelinkCandidate(asset, probed);
  if (probed.type !== asset.type || score.score < 0.35) {
    throw new Error(`Selected file does not look like a good match for ${asset.name}.`);
  }
  return mergeRelinkedAsset(asset, probed);
}

export async function relinkMissingMediaInDirectory(media: MediaAsset[]): Promise<RelinkFolderResult> {
  const directory = await openDirectoryDialog();
  if (!directory) {
    return { media, relinkedCount: 0, warnings: [] };
  }
  const files = (await scanDirectory(directory, 3)).filter((path) => inferAssetType(path));
  const plan = planBatchRelinkByFileName(media, files.map((path) => ({ path })), {
    caseInsensitive: isWindowsPath(directory)
  });
  const replacements = new Map<string, MediaAsset>();
  const warnings = plan.warnings.map((warning) =>
    warning.reason === 'duplicate-candidates'
      ? `${warning.fileName}: skipped because ${warning.candidatePaths.length} files share that name.`
      : `${warning.fileName}: no matching file found.`
  );

  for (const replacement of plan.replacements) {
    const asset = media.find((item) => item.id === replacement.assetId);
    if (!asset) {
      continue;
    }
    const probed = await probeMediaPath(replacement.candidatePath);
    if (probed.type === asset.type) {
      replacements.set(asset.id, mergeRelinkedAsset(asset, probed));
    } else {
      warnings.push(zhCN.errors.relinkTypeChanged(fileNameFromPath(replacement.candidatePath)));
    }
  }

  return {
    media: media.map((asset) => replacements.get(asset.id) ?? asset),
    relinkedCount: replacements.size,
    warnings
  };
}

function mergeRelinkedAsset(original: MediaAsset, probed: MediaAsset): MediaAsset {
  return {
    ...probed,
    id: original.id,
    missing: false,
    originalAbsolutePath: original.originalAbsolutePath ?? original.path
  };
}

function isWindowsPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.includes('\\');
}
