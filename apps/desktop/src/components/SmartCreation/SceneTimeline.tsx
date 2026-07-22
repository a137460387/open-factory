import { useCallback, useMemo } from 'react';
import { Film } from 'lucide-react';
import type { ContentSceneType } from '@open-factory/editor-core';
import { formatTimeShort } from '@open-factory/editor-core/utils/time';
import { featureStrings } from '../../i18n/featureStrings';

/** Scene boundary point from scene detection. */
export interface SceneBoundary {
  time: number;
  score: number;
  histogramDiff: number;
  motionDiff: number;
  threshold: number;
  sceneType?: ContentSceneType;
}

interface SceneTimelineProps {
  scenes: SceneBoundary[];
  onJumpToTime?: (time: number) => void;
}

const SCENE_COLORS: Record<ContentSceneType, string> = {
  indoor: '#6b7280',
  outdoor: '#22c55e',
  night: '#3b82f6',
  action: '#ef4444',
  dialogue: '#eab308',
  'close-up': '#a855f7',
};

export function SceneTimeline({ scenes, onJumpToTime }: SceneTimelineProps) {
  const t = featureStrings.smartCreation;

  const handleClick = useCallback(
    (time: number) => {
      onJumpToTime?.(time);
    },
    [onJumpToTime],
  );

  const segments = useMemo(() => {
    if (scenes.length === 0) return [];
    const sorted = [...scenes].sort((a, b) => a.time - b.time);
    return sorted.map((scene, i) => {
      const next = sorted[i + 1];
      const duration = next ? next.time - scene.time : 2;
      const sceneType = scene.sceneType ?? 'indoor';
      return { ...scene, duration, sceneType, index: i };
    });
  }, [scenes]);

  if (scenes.length === 0) {
    return (
      <div data-testid="scene-timeline-empty" className="text-xs text-neutral-500 text-center py-6">
        {t.noSceneData}
      </div>
    );
  }

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div data-testid="scene-timeline" className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Film size={12} />
        <span>{t.sceneCount(scenes.length)}</span>
      </div>

      {/* Timeline bar */}
      <div data-testid="scene-timeline-bar" className="flex h-8 rounded overflow-hidden border border-neutral-700">
        {segments.map((seg) => {
          const widthPct = totalDuration > 0 ? (seg.duration / totalDuration) * 100 : 100 / segments.length;
          const color = SCENE_COLORS[seg.sceneType] ?? '#6b7280';
          return (
            <button
              key={seg.index}
              data-testid={`scene-segment-${seg.index}`}
              onClick={() => handleClick(seg.time)}
              className="relative group flex items-center justify-center overflow-hidden transition-opacity hover:opacity-80"
              style={{
                width: `${widthPct}%`,
                backgroundColor: color,
                minWidth: '2px',
              }}
              title={`${t.sceneTypes[seg.sceneType] ?? seg.sceneType} ${formatTime(seg.time)}`}
            >
              {widthPct > 8 && (
                <span className="text-[9px] text-white/80 truncate px-0.5">
                  {t.sceneTypes[seg.sceneType] ?? seg.sceneType}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Scene list */}
      <div data-testid="scene-timeline-list" className="space-y-1 max-h-[160px] overflow-auto">
        {segments.map((seg) => {
          const color = SCENE_COLORS[seg.sceneType] ?? '#6b7280';
          return (
            <button
              key={seg.index}
              data-testid={`scene-item-${seg.index}`}
              onClick={() => handleClick(seg.time)}
              className="flex items-center gap-2 w-full text-xs bg-neutral-800 hover:bg-neutral-750 rounded p-1.5 transition-colors text-left"
            >
              <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              <span className="text-neutral-300 font-mono">{formatTime(seg.time)}</span>
              <span className="text-neutral-400 flex-1">{t.sceneTypes[seg.sceneType] ?? seg.sceneType}</span>
              <span className="text-neutral-600">{(seg.score * 100).toFixed(0)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
