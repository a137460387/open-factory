import type {Clip, AnomalyInterval} from '@open-factory/editor-core';

export function ClipOverlays({
  clip,
  onRemoveAnomaly,
}: {
  clip: Clip;
  onRemoveAnomaly(clipId: string, anomaly: AnomalyInterval): void;
}) {
  return (
    <>
      {Array.isArray(clip.flashWarnings) && clip.flashWarnings.length > 0 ? (
        <span
          className="absolute bottom-1.5 left-0 right-0 z-10 flex h-1"
          data-testid={`flash-warning-bars-${clip.id}`}
        >
          {clip.flashWarnings.map((fw, fi) => {
            const clipDuration = clip.duration || 1;
            const leftPct = Math.max(0, ((fw.startTime - clip.start) / clipDuration) * 100);
            const widthPct = Math.min(100 - leftPct, ((fw.endTime - fw.startTime) / clipDuration) * 100);
            const color =
              fw.severity === 'high'
                ? 'bg-[var(--color-danger)]'
                : fw.severity === 'medium'
                  ? 'bg-orange-400'
                  : 'bg-yellow-300';
            return (
              <span
                key={fi}
                className={`absolute h-1 ${color} opacity-70`}
                style={{ left: leftPct + '%', width: widthPct + '%' }}
                data-testid={`flash-bar-${clip.id}-${fi}`}
              />
            );
          })}
        </span>
      ) : null}
      {(clip.anomalies ?? []).length > 0 && (
        <span className="absolute bottom-0 left-0 right-0 z-10 flex h-1.5" data-testid={'anomaly-markers-' + clip.id}>
          {(clip.anomalies ?? []).map((anomaly, idx) => (
            <span
              key={idx}
              className="cursor-pointer h-1.5 flex-1"
              style={{ backgroundColor: anomaly.type === 'black' ? '#ef4444' : '#eab308' }}
              title={anomaly.type === 'black' ? '黑场' : '静态长镜头'}
              data-testid={'anomaly-marker-' + clip.id + '-' + idx}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveAnomaly(clip.id, anomaly);
              }}
            />
          ))}
        </span>
      )}
    </>
  );
}
