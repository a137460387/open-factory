import {memo} from 'react';
import {AlertTriangle} from 'lucide-react';
import type {Clip} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';

export function MusicStructureMarkers({
  trackId,
  musicStructure,
  zoom,
}: {
  trackId: string;
  musicStructure: Array<{time: number; type: string}>;
  zoom: number;
}) {
  return (
    <span
      className="absolute inset-0 z-[2] pointer-events-none"
      data-testid={`music-structure-markers-${trackId}`}
    >
      {musicStructure.map((ms, mi) => {
        const color =
          ms.type === 'energy_rise'
            ? 'bg-green-500'
            : ms.type === 'energy_drop'
              ? 'bg-[var(--color-danger)]'
              : 'bg-[var(--color-accent)]';
        const label =
          ms.type === 'energy_rise'
            ? zhCN.musicStructure.energyRise
            : ms.type === 'energy_drop'
              ? zhCN.musicStructure.energyDrop
              : zhCN.musicStructure.timbreShift;
        return (
          <span
            key={mi}
            className={`absolute top-0 bottom-0 w-px ${color} opacity-60`}
            style={{left: ms.time * zoom}}
            data-testid={`music-structure-marker-${trackId}-${mi}`}
            title={label}
          />
        );
      })}
    </span>
  );
}

export function ContinuityWarnings({
  trackId,
  warnings,
  sortedClips,
  zoom,
}: {
  trackId: string;
  warnings: Array<{clipAId: string; clipBId: string; type: string; confidence: number; reason: string}>;
  sortedClips: Clip[];
  zoom: number;
}) {
  return (
    <span className="absolute inset-0 z-[3] pointer-events-none" data-testid={`continuity-warnings-${trackId}`}>
      {warnings.map((w, wi) => {
        const boundaryClip = sortedClips.find((c) => c.id === w.clipAId);
        if (!boundaryClip) return null;
        const boundaryTime = boundaryClip.start + boundaryClip.duration;
        const isAxisJump = w.type === 'axis_jump';
        const label = isAxisJump ? zhCN.continuityCheck.axisJump : zhCN.continuityCheck.jumpCut;
        return (
          <span
            key={wi}
            className={`absolute top-1 z-[3] flex h-5 w-5 items-center justify-center rounded-full ${isAxisJump ? 'bg-[var(--color-danger)]' : 'bg-orange-400'} text-white shadow cursor-pointer pointer-events-auto`}
            style={{left: boundaryTime * zoom - 10}}
            title={label + ': ' + w.reason}
            data-testid={`continuity-warning-${w.clipAId}-${w.clipBId}-${w.type}`}
          >
            <AlertTriangle size={12} />
          </span>
        );
      })}
    </span>
  );
}

export function ColorConsistencyWarnings({
  trackId,
  warnings,
  sortedClips,
  zoom,
}: {
  trackId: string;
  warnings: Array<{clipAId: string; clipBId: string; type: string; deltaRGB: number | null; reason: string}>;
  sortedClips: Clip[];
  zoom: number;
}) {
  return (
    <span
      className="absolute inset-0 z-[4] pointer-events-none"
      data-testid={`color-consistency-warnings-${trackId}`}
    >
      {warnings.map((w, wi) => {
        const boundaryClip = sortedClips.find((c) => c.id === w.clipAId);
        if (!boundaryClip) return null;
        const boundaryTime = boundaryClip.start + boundaryClip.duration;
        const label =
          w.type === 'skin_tone'
            ? zhCN.colorConsistency.skinTone
            : w.type === 'white_balance'
              ? zhCN.colorConsistency.whiteBalance
              : zhCN.colorConsistency.both;
        return (
          <span
            key={wi}
            className="absolute top-1 z-[4] flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-white shadow cursor-pointer pointer-events-auto"
            style={{left: boundaryTime * zoom - 10}}
            title={
              zhCN.colorConsistency.title +
              ': ' +
              label +
              (w.deltaRGB != null ? ' (ΔRGB=' + w.deltaRGB.toFixed(1) + ')' : '')
            }
            data-testid={`color-consistency-warning-${w.clipAId}-${w.clipBId}-${w.type}`}
          >
            <span>🎨</span>
          </span>
        );
      })}
    </span>
  );
}

export function SfxSuggestions({
  trackId,
  suggestions,
  zoom,
}: {
  trackId: string;
  suggestions: Array<{time: number; category: string; confidence: number; matchedAssetId: string | null; status: string}>;
  zoom: number;
}) {
  return (
    <span className="absolute inset-0 z-[5] pointer-events-none" data-testid={`sfx-suggestions-${trackId}`}>
      {suggestions.map((s, si) => (
        <span
          key={si}
          className="absolute bottom-0 z-[5] flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-white shadow cursor-pointer pointer-events-auto"
          style={{left: s.time * zoom - 8}}
          title={
            zhCN.sfxMatch.candidatePoint +
            ': ' +
            s.category +
            ' (' +
            (s.confidence * 100).toFixed(0) +
            '%)' +
            (s.matchedAssetId ? '' : ' - ' + zhCN.sfxMatch.noMatch)
          }
          data-testid={`sfx-suggestion-${trackId}-${si}`}
          data-sfx-status={s.status}
        >
          <span className="text-[9px]">♪</span>
        </span>
      ))}
    </span>
  );
}
