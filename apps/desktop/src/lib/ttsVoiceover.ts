import {
  BatchAddClipsCommand,
  generateTtsCacheKey,
  detectTtsEngine,
  type Clip,
  type MediaAsset,
  type SubtitleClip,
  type Project,
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { useAISettingsStore } from '../store/aiSettingsStore';
import { useEditorStore } from '../store/editorStore';
import { commandManager, timelineAccessor } from '../store/commandManager';
import { showToast } from './toast';
import { callTtsApi, writeBinaryFile, fsExists, getAppDataDir } from './tauri-bridge';

interface TtsClipInput {
  id: string;
  text: string;
  start: number;
  duration: number;
}

/**
 * Generate TTS voiceover audio clips for the given text/subtitle clips.
 * Creates a new audio track and adds audio clips aligned to original timing.
 */
export async function generateTtsVoiceover(clips: TtsClipInput[]): Promise<void> {
  const aiState = useAISettingsStore.getState();
  const providerId = aiState.serviceMapping['voiceover'];
  const provider = aiState.providers.find((p) => p.id === providerId && p.enabled);
  if (!provider || !aiState.ttsVoiceId) {
    showToast({
      kind: 'warning',
      title: zhCN.aiTts.failedTitle,
      message: zhCN.aiTts.noProvider,
    });
    return;
  }

  const engine = detectTtsEngine(provider.baseUrl, provider.id);
  const validClips = clips.filter((c) => c.text.trim().length > 0);
  if (validClips.length === 0) return;

  showToast({ kind: 'info', title: zhCN.aiTts.generating });

  try {
    const appDataDir = await getAppDataDir();
    const ttsCacheDir = `${appDataDir}/open-factory/tts-cache`;
    const ttsTrackId = `tts-audio-${Date.now()}`;
    const ttsClips: Clip[] = [];
    const newAssets: MediaAsset[] = [];

    for (const sub of validClips) {
      const cacheKey = generateTtsCacheKey(sub.text, {
        providerId: provider.id,
        baseUrl: provider.baseUrl,
        engine,
        voiceId: aiState.ttsVoiceId,
        speed: aiState.ttsSpeed,
        stability: aiState.ttsStability,
      });
      const cachePath = `${ttsCacheDir}/${cacheKey}.mp3`;
      const cached = await fsExists(cachePath);

      if (!cached) {
        const result = await callTtsApi(
          {
            baseUrl: provider.baseUrl,
            voiceId: aiState.ttsVoiceId,
            text: sub.text,
            speed: aiState.ttsSpeed,
            stability: aiState.ttsStability,
            engine,
          },
          provider.apiKey,
        );
        await writeBinaryFile(cachePath, result.audioBase64);
      }

      const assetId = `tts-asset-${cacheKey}`;
      newAssets.push({
        id: assetId,
        type: 'audio',
        name: `TTS: ${sub.text.slice(0, 30)}`,
        path: cachePath,
        duration: sub.duration,
        width: 0,
        height: 0,
        hasAudio: true,
      });
      ttsClips.push({
        id: `tts-clip-${cacheKey}`,
        type: 'audio',
        trackId: ttsTrackId,
        start: sub.start,
        duration: sub.duration,
        mediaId: assetId,
        volume: 1,
      } as Clip);
    }

    if (ttsClips.length === 0) {
      showToast({
        kind: 'warning',
        title: zhCN.aiTts.failedTitle,
        message: zhCN.aiTts.failedMessage,
      });
      return;
    }

    useEditorStore.getState().addMedia(newAssets);
    const cmd = new BatchAddClipsCommand(timelineAccessor, ttsClips, [
      { id: ttsTrackId, name: 'AI配音', type: 'audio' as const },
    ]);
    commandManager.execute(cmd);
    showToast({
      kind: 'success',
      title: zhCN.aiTts.applied,
      message: zhCN.aiTts.appliedMessage(ttsClips.length),
    });
  } catch (error) {
    showToast({
      kind: 'error',
      title: zhCN.aiTts.failedTitle,
      message: error instanceof Error ? error.message : zhCN.aiTts.failedMessage,
    });
  }
}

/**
 * Collect subtitle clips from a track for TTS generation.
 */
export function collectSubtitleClipsForTts(project: Project, trackId: string): TtsClipInput[] {
  const track = project.timeline.tracks.find((t) => t.id === trackId && t.type === 'subtitle');
  if (!track) return [];
  return (track.clips.filter((c) => c.type === 'subtitle') as SubtitleClip[])
    .sort((a, b) => a.start - b.start)
    .map((c) => ({
      id: c.id,
      text: c.text,
      start: c.start,
      duration: c.duration,
    }));
}
