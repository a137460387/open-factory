import { cloneClipKeyframes, createKeyframe, normalizeClipKeyframes } from './keyframes';
import { normalizeMotionTrack, type ClipKeyframes, type MotionTrackPoint, type Transform } from './model';

export function motionTrackToPositionKeyframes(
  points: readonly Partial<MotionTrackPoint>[] | undefined,
  transform: Transform,
  duration: number,
): ClipKeyframes {
  const motionTrack = normalizeMotionTrack(points, duration) ?? [];
  return {
    x: motionTrack.map((point, index) =>
      createKeyframe(
        'x',
        { id: `motion-track-x-${index}`, time: point.time, value: transform.x + point.dx, easing: 'linear' },
        duration,
      ),
    ),
    y: motionTrack.map((point, index) =>
      createKeyframe(
        'y',
        { id: `motion-track-y-${index}`, time: point.time, value: transform.y + point.dy, easing: 'linear' },
        duration,
      ),
    ),
  };
}

export function bindMotionTrackToPositionKeyframes(
  existing: ClipKeyframes | undefined,
  points: readonly Partial<MotionTrackPoint>[] | undefined,
  transform: Transform,
  duration: number,
): ClipKeyframes | undefined {
  const motionKeyframes = motionTrackToPositionKeyframes(points, transform, duration);
  const next = cloneClipKeyframes(existing) ?? {};
  next.x = motionKeyframes.x;
  next.y = motionKeyframes.y;
  return normalizeClipKeyframes(next, duration);
}
