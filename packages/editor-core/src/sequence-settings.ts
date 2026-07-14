/**
 * 序列独立设置模块
 * 允许每个 Sequence 拥有独立的帧率/分辨率/时长设置
 */
import type { ProjectSettings, Sequence, SequenceSettings } from './model-types';
import { round } from './time';

export type { SequenceSettings };

/**
 * 获取序列的有效设置，未设置的字段继承项目级设置
 */
export function getEffectiveSequenceSettings(sequence: Sequence, projectSettings: ProjectSettings): ProjectSettings {
  const seqSettings = (sequence as Sequence & { settings?: SequenceSettings }).settings;
  if (!seqSettings) {
    return projectSettings;
  }
  return {
    fps: seqSettings.frameRate ?? projectSettings.fps,
    width: seqSettings.width ?? projectSettings.width,
    height: seqSettings.height ?? projectSettings.height,
    timecodeFormat: projectSettings.timecodeFormat,
    vfrHandling: projectSettings.vfrHandling,
    colorPipeline: projectSettings.colorPipeline,
    workingColorSpace: projectSettings.workingColorSpace,
  };
}

/**
 * 帧率变更时将 clip 位置从旧帧率重新对齐到新帧率
 * 不修改 clip.duration（那是源时间），只修改 clip.start
 */
export function recalculateClipStartsForFrameRate(
  timeline: { tracks: { clips: { start: number }[] }[] },
  oldFps: number,
  newFps: number,
): void {
  if (oldFps <= 0 || newFps <= 0 || oldFps === newFps) return;
  const ratio = oldFps / newFps;
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      clip.start = round(clip.start * ratio);
    }
  }
}
