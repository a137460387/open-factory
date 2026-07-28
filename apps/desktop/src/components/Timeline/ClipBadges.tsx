import type {Clip} from '@open-factory/editor-core';
import {EMOTION_COLORS} from '@open-factory/editor-core';
import {AlertTriangle} from 'lucide-react';
import {zhCN} from '../../i18n/strings';

export function ClipBadges({
  clip,
  transitionRightOffset,
}: {
  clip: Clip;
  transitionRightOffset: boolean;
}) {
  return (
    <>
      {clip.type === 'video' && (clip.stabilization?.shakeScore ?? 0) > 50 ? (
        <span
          className="absolute bottom-1 right-1 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-white shadow"
          title={zhCN.preview.shakeAnalysisHigh}
          data-testid={`shake-badge-${clip.id}`}
        >
          <AlertTriangle size={11} />
        </span>
      ) : null}
      {'motionType' in clip && (clip as { motionType?: { type: string; confidence: number } }).motionType ? (
        <span
          className="absolute bottom-1 left-1 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-white shadow"
          title={
            zhCN.motionType.title +
            ': ' +
            ((zhCN.motionType as Record<string, string>)[(clip as { motionType: { type: string } }).motionType.type] ??
              (clip as { motionType: { type: string } }).motionType.type)
          }
          data-testid={`motion-type-badge-${clip.id}`}
          data-motion-type={(clip as { motionType: { type: string } }).motionType.type}
        >
          <span className="text-[8px] font-bold">M</span>
        </span>
      ) : null}
      {clip.type === 'video' && clip.aiPipSuggestion ? (
        <span
          className="absolute bottom-1 left-5 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow"
          title={zhCN.preview.pipAvoidanceWarning}
          data-testid={`pip-warning-${clip.id}`}
        >
          <AlertTriangle size={11} />
        </span>
      ) : null}
      {Array.isArray(clip.flashWarnings) && clip.flashWarnings.length > 0 ? (
        <span
          className="absolute bottom-1 right-5 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow"
          title={zhCN.flashWarning.badge + ' (' + clip.flashWarnings.length + ')'}
          data-testid={`flash-warning-badge-${clip.id}`}
        >
          <AlertTriangle size={11} />
        </span>
      ) : null}
      {'readingSpeedWarning' in clip &&
      (clip as { readingSpeedWarning?: { severity: string } | null }).readingSpeedWarning ? (
        <span
          className={`absolute bottom-1 right-9 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full ${(clip as { readingSpeedWarning: { severity: string } }).readingSpeedWarning.severity === 'critical' ? 'bg-[var(--color-danger)]' : 'bg-yellow-400'} text-white shadow`}
          title={
            zhCN.subtitleReadingSpeed.title +
            ' (' +
            (clip as { readingSpeedWarning: { charsPerSecond: number } }).readingSpeedWarning.charsPerSecond.toFixed(
              1,
            ) +
            ' ' +
            zhCN.subtitleReadingSpeed.charsPerSecond +
            ')'
          }
          data-testid={`reading-speed-warning-${clip.id}`}
        >
          <AlertTriangle size={11} />
        </span>
      ) : null}
      {'emotionAnalysis' in clip &&
      (clip as { emotionAnalysis?: { emotionTone: string; intensity: number } }).emotionAnalysis ? (
        <span
          className="absolute bottom-0 left-0 right-0 z-20 h-[3px]"
          style={{
            backgroundColor:
              EMOTION_COLORS[
                (clip as { emotionAnalysis: { emotionTone: keyof typeof EMOTION_COLORS } }).emotionAnalysis.emotionTone
              ],
          }}
          title={`${zhCN.emotionTone.title}: ${zhCN.emotionTone[(clip as { emotionAnalysis: { emotionTone: string } }).emotionAnalysis.emotionTone as keyof typeof zhCN.emotionTone] ?? (clip as { emotionAnalysis: { emotionTone: string } }).emotionAnalysis.emotionTone} (${Math.round((clip as { emotionAnalysis: { intensity: number } }).emotionAnalysis.intensity * 100)}%)`}
          data-testid={`emotion-bar-${clip.id}`}
        />
      ) : null}
    </>
  );
}
