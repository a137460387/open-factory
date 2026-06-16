import { getClipSourceVisibleDuration, getClipSpeed, type Clip, type MediaAsset, type Timeline, type Track } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { markLocalAiModelUsed } from '../settings/appSettings';
import { buildSubtitleTrackFromSrt } from './subtitles';
import { fsExists, openFileDialog, runWhisper, type WhisperRequest, type WhisperResult } from './tauri-bridge';

export interface WhisperSettings {
  executablePath: string;
  modelPath: string;
}

export interface WhisperAvailability {
  ready: boolean;
  error?: string;
}

interface WhisperDependencies {
  exists?: (path: string) => Promise<boolean>;
  run?: (request: WhisperRequest) => Promise<WhisperResult>;
}

export async function pickWhisperExecutablePath(): Promise<string | undefined> {
  const [path] = await openFileDialog(false, []);
  return path;
}

export async function pickWhisperModelPath(): Promise<string | undefined> {
  const [path] = await openFileDialog(false, [{ name: zhCN.fileDialogs.whisperModel, extensions: ['bin', 'gguf'] }]);
  return path;
}

export async function getWhisperAvailability(settings: WhisperSettings, exists: (path: string) => Promise<boolean> = fsExists): Promise<WhisperAvailability> {
  try {
    await assertWhisperSettingsReady(settings, exists);
    return { ready: true };
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : zhCN.whisper.notConfigured };
  }
}

export async function assertWhisperSettingsReady(settings: WhisperSettings, exists: (path: string) => Promise<boolean> = fsExists): Promise<void> {
  const executablePath = settings.executablePath.trim();
  const modelPath = settings.modelPath.trim();
  if (!executablePath || !modelPath) {
    throw new Error(zhCN.whisper.notConfigured);
  }
  const [executableExists, modelExists] = await Promise.all([exists(executablePath), exists(modelPath)]);
  if (!executableExists) {
    throw new Error(zhCN.whisper.executableMissing);
  }
  if (!modelExists) {
    throw new Error(zhCN.whisper.modelMissing);
  }
}

export function canGenerateSubtitlesForClip(clip: Clip | undefined, asset: MediaAsset | undefined, whisperReady: boolean): boolean {
  return Boolean(whisperReady && clip && asset && (clip.type === 'audio' || clip.type === 'video') && !asset.missing);
}

export async function buildWhisperSubtitleTrackForClip(
  clip: Extract<Clip, { type: 'audio' | 'video' }>,
  asset: MediaAsset,
  timeline: Timeline,
  settings: WhisperSettings,
  dependencies: WhisperDependencies = {}
): Promise<Track> {
  await assertWhisperSettingsReady(settings, dependencies.exists ?? fsExists);
  await markLocalAiModelUsed('whisper', settings.modelPath).catch((error) => {
    console.warn('Unable to update Whisper model last-used time', error);
  });
  const executeWhisper = dependencies.run ?? runWhisper;
  const result = await executeWhisper({
    executablePath: settings.executablePath.trim(),
    modelPath: settings.modelPath.trim(),
    audioPath: asset.path,
    clipId: clip.id
  });
  return buildSubtitleTrackFromSrt(result.srtPath, result.contents, timeline, {
    timelineStart: clip.start,
    sourceStart: clip.trimStart,
    sourceDuration: getClipSourceVisibleDuration(clip),
    speed: getClipSpeed(clip)
  });
}
