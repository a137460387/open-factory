import type {Clip} from '@open-factory/editor-core';
import {getClipSourceVisibleDuration, getClipSpeed, round} from '@open-factory/editor-core';
import {dirname} from '@open-factory/editor-core';
import {getAppDataDir} from '../../../../lib/tauri-bridge';
import {LABEL_WIDTH} from '../../TimelineParts';
import type {SubtitleAlignmentMediaClip} from './types';

export const SUBTITLE_ALIGNMENT_SAMPLES_PER_SECOND = 20;
export const SUBTITLE_ALIGNMENT_MAX_DISTANCE = 0.3;
export const TRANSITION_DRAG_MIME = 'application/x-transition-type';

export function isCreditsTextFile(file: File): boolean {
  return /\.(txt|csv)$/i.test(file.name);
}

export function getTimelineDropStart(
  event: React.DragEvent<HTMLDivElement>,
  scroll: HTMLDivElement | null,
  zoom: number,
): number | undefined {
  const rect = scroll?.getBoundingClientRect();
  return rect && scroll
    ? round(Math.max(0, (event.clientX - rect.left + scroll.scrollLeft - LABEL_WIDTH) / zoom))
    : undefined;
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? ''));
}

export function buildSubtitleAlignmentPeaks(
  samples: number[],
  samplesPerSec: number,
  sourceClip: SubtitleAlignmentMediaClip,
): number[] {
  const sampleRate = Math.max(1, samplesPerSec);
  const peakLevel = samples.reduce((max, value) => (Number.isFinite(value) ? Math.max(max, value) : max), 0);
  const threshold = Math.max(0.05, peakLevel * 0.6);
  const trimStart = Math.max(0, sourceClip.trimStart ?? 0);
  const sourceEnd = trimStart + getClipSourceVisibleDuration(sourceClip);
  const speed = Math.max(0.01, getClipSpeed(sourceClip));
  const peaks: number[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const value = Number.isFinite(samples[index]) ? samples[index] : 0;
    if (value < threshold || value < (samples[index - 1] ?? 0) || value < (samples[index + 1] ?? 0)) {
      continue;
    }
    const sourceTime = index / sampleRate;
    if (sourceTime < trimStart || sourceTime > sourceEnd) {
      continue;
    }
    const timelineTime = sourceClip.start + (sourceTime - trimStart) / speed;
    if (!peaks.some((peak) => Math.abs(peak - timelineTime) < 1 / sampleRate)) {
      peaks.push(round(timelineTime));
    }
  }
  return peaks;
}

export function isSubtitleAlignmentMediaClip(clip: Clip): clip is SubtitleAlignmentMediaClip {
  return clip.type === 'audio' || clip.type === 'video';
}

export function timelineRangesOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

export function joinLocalPath(baseDir: string, child: string): string {
  return `${baseDir.replace(/\\/g, '/').replace(/\/+$/g, '')}/${child}`;
}

export async function getCoverFrameOutputDir(projectPath: string | undefined): Promise<string> {
  const baseDir = projectPath ? dirname(projectPath) : await getAppDataDir();
  return joinLocalPath(baseDir, 'covers');
}
