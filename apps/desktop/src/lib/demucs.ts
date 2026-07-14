import {
  createId,
  createTrack,
  getClipSourceVisibleDuration,
  getClipSpeed,
  type Clip,
  type MediaAsset,
  type Track,
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { markLocalAiModelUsed } from '../settings/appSettings';
import { createClipFromAsset } from './clipFactory';
import {
  fsExists,
  getFileStat,
  openFileDialog,
  runDemucs,
  type DemucsRequest,
  type DemucsResult,
  type FileStat,
} from './tauri-bridge';

export interface DemucsSettings {
  executablePath: string;
}

export interface DemucsAvailability {
  ready: boolean;
  error?: string;
}

export interface DemucsSeparationResult {
  result: DemucsResult;
  media: [MediaAsset, MediaAsset];
  tracks: [Track, Track];
}

interface DemucsDependencies {
  exists?: (path: string) => Promise<boolean>;
  run?: (request: DemucsRequest) => Promise<DemucsResult>;
  stat?: (path: string) => Promise<FileStat>;
}

export async function pickDemucsExecutablePath(): Promise<string | undefined> {
  const [path] = await openFileDialog(false, []);
  return path;
}

export async function getDemucsAvailability(
  settings: DemucsSettings,
  exists: (path: string) => Promise<boolean> = fsExists,
): Promise<DemucsAvailability> {
  try {
    await assertDemucsSettingsReady(settings, exists);
    return { ready: true };
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : zhCN.demucs.notConfigured };
  }
}

export async function assertDemucsSettingsReady(
  settings: DemucsSettings,
  exists: (path: string) => Promise<boolean> = fsExists,
): Promise<void> {
  const executablePath = settings.executablePath.trim();
  if (!executablePath) {
    throw new Error(zhCN.demucs.notConfigured);
  }
  if (!(await exists(executablePath))) {
    throw new Error(zhCN.demucs.executableMissing);
  }
}

export function canSeparateAudioForClip(
  clip: Clip | undefined,
  asset: MediaAsset | undefined,
  demucsReady: boolean,
): boolean {
  return Boolean(
    demucsReady &&
    clip &&
    asset &&
    (clip.type === 'audio' || clip.type === 'video') &&
    (asset.type === 'audio' || asset.hasAudio) &&
    !asset.missing,
  );
}

export async function separateAudioForClip(
  clip: Extract<Clip, { type: 'audio' | 'video' }>,
  asset: MediaAsset,
  settings: DemucsSettings,
  dependencies: DemucsDependencies = {},
): Promise<DemucsSeparationResult> {
  await assertDemucsSettingsReady(settings, dependencies.exists ?? fsExists);
  await markLocalAiModelUsed('demucs', settings.executablePath).catch((error) => {
    console.warn('Unable to update Demucs model last-used time', error);
  });
  const execute = dependencies.run ?? runDemucs;
  const result = await execute({
    executablePath: settings.executablePath.trim(),
    mediaPath: asset.path,
    clipId: clip.id,
  });
  const media = await buildSeparatedAudioMediaAssets(clip, asset, result, dependencies.stat ?? getFileStat);
  const tracks = buildSeparatedAudioTracksForClip(clip, media);
  return { result, media, tracks };
}

export async function buildSeparatedAudioMediaAssets(
  clip: Extract<Clip, { type: 'audio' | 'video' }>,
  sourceAsset: MediaAsset,
  result: DemucsResult,
  stat: (path: string) => Promise<FileStat> = getFileStat,
): Promise<[MediaAsset, MediaAsset]> {
  const [vocalsStat, accompanimentStat] = await Promise.all([
    safeStat(result.vocalsPath, stat),
    safeStat(result.accompanimentPath, stat),
  ]);
  return [
    createSeparatedAsset(clip, sourceAsset, result.vocalsPath, zhCN.demucs.vocalsSuffix, vocalsStat),
    createSeparatedAsset(
      clip,
      sourceAsset,
      result.accompanimentPath,
      zhCN.demucs.accompanimentSuffix,
      accompanimentStat,
    ),
  ];
}

export function buildSeparatedAudioTracksForClip(
  clip: Extract<Clip, { type: 'audio' | 'video' }>,
  media: [MediaAsset, MediaAsset],
): [Track, Track] {
  return media.map((asset, index) => {
    const track = createTrack({
      id: createId('track'),
      type: 'audio',
      name: index === 0 ? zhCN.demucs.vocalsTrackName : zhCN.demucs.accompanimentTrackName,
      clips: [],
    });
    const baseClip = createClipFromAsset(asset, track, { tracks: [track], transitions: [], markers: [] });
    return createTrack({
      ...track,
      clips: [
        {
          ...baseClip,
          name: asset.name,
          trackId: track.id,
          start: clip.start,
          duration: clip.duration,
          trimStart: clip.trimStart,
          trimEnd: 0,
          speed: getClipSpeed(clip),
        },
      ],
    });
  }) as [Track, Track];
}

function createSeparatedAsset(
  clip: Extract<Clip, { type: 'audio' | 'video' }>,
  sourceAsset: MediaAsset,
  path: string,
  suffix: string,
  stat?: FileStat,
): MediaAsset {
  return {
    id: createId('asset'),
    type: 'audio',
    name: `${clip.name || sourceAsset.name} ${suffix}.wav`,
    path,
    importedAt: new Date().toISOString(),
    duration: Math.max(sourceAsset.duration || getClipSourceVisibleDuration(clip) || clip.duration, clip.duration, 0),
    width: 0,
    height: 0,
    size: stat?.size,
    mtimeMs: stat?.mtimeMs,
    hasAudio: true,
    audioChannels: sourceAsset.audioChannels ?? 2,
    audioSampleRate: sourceAsset.audioSampleRate ?? 44_100,
    audioCodec: 'pcm_s16le',
  };
}

async function safeStat(path: string, stat: (path: string) => Promise<FileStat>): Promise<FileStat | undefined> {
  try {
    return await stat(path);
  } catch {
    return undefined;
  }
}
