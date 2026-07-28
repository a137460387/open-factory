import {getClipSpeed, calculateSpeedCurveSourceDuration} from '../../timeline';
import {round} from '../../time';
import {formatFfmpegNumber, formatScale, formatOpacity, formatOffsetExpression, getAnimatedFrames, buildTimelineExpression} from './utils';
import {formatFfmpegSeconds} from '../ffmpeg-escape';
import {SETPTS_EXPRESSION_LIMIT} from './settings-normalize';
import type {ExportClip, ExportSettings} from '../export-types';

export function isKenBurnsAnimatedScaleClip(clip: ExportClip): boolean {
  return (
    clip.type === 'image' &&
    clip.kenBurns &&
    (getAnimatedFrames(clip, 'scaleX').length >= 2 || getAnimatedFrames(clip, 'scaleY').length >= 2)
  );
}

export function buildSetptsFilter(clip: ExportClip, includeStartOffset: boolean, warnings?: string[]): string {
  if (clip.type !== 'image' && getAnimatedFrames(clip, 'speed').length > 0) {
    const expression = buildSpeedRampSetptsExpression(clip, includeStartOffset);
    const filter = `setpts='${expression}'`;
    if (filter.length <= SETPTS_EXPRESSION_LIMIT) {
      return filter;
    }
    warnings?.push(`Speed ramp setpts for clip ${clip.id} exceeded 4096 characters and fell back to average speed.`);
    return buildStaticSetptsFilter(clip, includeStartOffset, getAverageClipSpeed(clip));
  }
  return buildStaticSetptsFilter(clip, includeStartOffset, clip.speed);
}

export function buildStaticSetptsFilter(clip: ExportClip, includeStartOffset: boolean, speed: number): string {
  const startOffset = `${formatFfmpegSeconds(clip.start)}/TB`;
  const playbackSpeed = getClipSpeed({ speed });
  if (Math.abs(playbackSpeed - 1) < 0.001 || clip.type === 'image') {
    return includeStartOffset ? `setpts=PTS-STARTPTS+${startOffset}` : 'setpts=PTS-STARTPTS';
  }
  return includeStartOffset
    ? `setpts=(PTS-STARTPTS)/${formatFfmpegSeconds(playbackSpeed)}+${startOffset}`
    : `setpts=(PTS-STARTPTS)/${formatFfmpegSeconds(playbackSpeed)}`;
}

export function buildSpeedRampSetptsExpression(clip: ExportClip, includeStartOffset: boolean): string {
  const sourceTime = '((PTS-STARTPTS)*TB)';
  const segments = buildSpeedRampSegments(clip);
  let secondsExpression = formatFfmpegSeconds(clip.duration);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const localExpression = `${formatFfmpegSeconds(segment.displayStart)}+(${sourceTime}-${formatFfmpegSeconds(segment.sourceStart)})/${formatFfmpegSeconds(segment.speed)}`;
    secondsExpression = `if(lte(${sourceTime},${formatFfmpegSeconds(segment.sourceEnd)}),${localExpression},${secondsExpression})`;
  }
  const startOffset = includeStartOffset ? `+${formatFfmpegSeconds(clip.start)}/TB` : '';
  return `(${secondsExpression})/TB${startOffset}`;
}

export function buildSpeedRampSegments(
  clip: ExportClip,
): Array<{ displayStart: number; displayEnd: number; sourceStart: number; sourceEnd: number; speed: number }> {
  const duration = Math.max(0, clip.duration);
  const frames = getAnimatedFrames(clip, 'speed');
  if (duration <= 0 || frames.length === 0) {
    return [];
  }

  const points = [...frames];
  if (points[0].time > 0.000001) {
    points.unshift({ id: `${clip.id}-speed-start`, time: 0, value: clip.speed, easing: 'linear' });
  } else {
    points[0] = { ...points[0], time: 0 };
  }
  const lastPoint = points[points.length - 1];
  if (lastPoint.time < duration - 0.000001) {
    points.push({ ...lastPoint, id: `${clip.id}-speed-end`, time: duration });
  } else {
    points[points.length - 1] = { ...lastPoint, time: duration };
  }

  let sourceStart = 0;
  const segments: Array<{
    displayStart: number;
    displayEnd: number;
    sourceStart: number;
    sourceEnd: number;
    speed: number;
  }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    const displayStart = Math.max(0, Math.min(duration, left.time));
    const displayEnd = Math.max(0, Math.min(duration, right.time));
    const displayDuration = displayEnd - displayStart;
    if (displayDuration <= 0.000001) {
      continue;
    }
    const localSpeedFrames = {
      speed: [
        { ...left, time: 0 },
        { ...right, time: displayDuration },
      ],
    };
    const sourceDuration = calculateSpeedCurveSourceDuration(displayDuration, localSpeedFrames, left.value);
    const segmentSpeed = Math.max(0.001, sourceDuration / displayDuration);
    const sourceEnd = round(sourceStart + sourceDuration);
    segments.push({
      displayStart,
      displayEnd,
      sourceStart,
      sourceEnd,
      speed: segmentSpeed,
    });
    sourceStart = sourceEnd;
  }
  return segments;
}

export function getAverageClipSpeed(clip: ExportClip): number {
  if (clip.duration <= 0.000001) {
    return clip.speed;
  }
  return getClipSpeed({ speed: clip.sourceDuration / clip.duration });
}

export function buildScaleFilter(clip: ExportClip): string {
  const scaleX = getAnimatedFrames(clip, 'scaleX');
  const scaleY = getAnimatedFrames(clip, 'scaleY');
  if (scaleX.length >= 2 || scaleY.length >= 2) {
    const xExpression = buildTimelineExpression(scaleX, clip.start, clip.transform.scaleX ?? clip.transform.scale);
    const yExpression = buildTimelineExpression(scaleY, clip.start, clip.transform.scaleY ?? clip.transform.scale);
    return `scale=w='trunc(iw*(${xExpression})/2)*2':h='trunc(ih*(${yExpression})/2)*2':eval=frame`;
  }
  const staticScaleX = scaleX.length === 1 ? scaleX[0].value : (clip.transform.scaleX ?? clip.transform.scale);
  const staticScaleY = scaleY.length === 1 ? scaleY[0].value : (clip.transform.scaleY ?? clip.transform.scale);
  return `scale=trunc(iw*${formatScale(staticScaleX)}/2)*2:trunc(ih*${formatScale(staticScaleY)}/2)*2`;
}

export function buildKenBurnsZoompanFilter(clip: ExportClip, settings: ExportSettings): string {
  const scaleX = getAnimatedFrames(clip, 'scaleX');
  const scaleY = getAnimatedFrames(clip, 'scaleY');
  const zoomFrames = scaleX.length >= 2 ? scaleX : scaleY;
  const zoomExpression = buildTimelineExpression(zoomFrames, 0, clip.transform.scaleX ?? clip.transform.scale, 'ot');
  return `zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=2:s=${settings.width}x${settings.height}:fps=${settings.fps}`;
}

export function buildOpacityFilters(clip: ExportClip, label: string): string[] {
  const frames = getAnimatedFrames(clip, 'opacity');
  if (frames.length === 0) {
    return [`colorchannelmixer=aa=${formatOpacity(clip.transform.opacity)}[${label}]`];
  }
  if (frames.length === 1) {
    return [`colorchannelmixer=aa=${formatOpacity(frames[0].value)}[${label}]`];
  }
  if (frames.length === 2) {
    const [first, second] = frames;
    const duration = Math.max(0.001, second.time - first.time);
    const start = clip.start + first.time;
    if (first.value <= 0.001 && second.value >= 0.999) {
      return [
        `colorchannelmixer=aa=1`,
        `fade=t=in:st=${formatFfmpegSeconds(start)}:d=${formatFfmpegSeconds(duration)}:alpha=1[${label}]`,
      ];
    }
    if (first.value >= 0.999 && second.value <= 0.001) {
      return [
        `colorchannelmixer=aa=1`,
        `fade=t=out:st=${formatFfmpegSeconds(start)}:d=${formatFfmpegSeconds(duration)}:alpha=1[${label}]`,
      ];
    }
  }
  const expression = buildTimelineExpression(frames, clip.start, clip.transform.opacity, 'T');
  return [`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${expression})'[${label}]`];
}

export function buildOverlayXExpression(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'x');
  if (frames.length >= 2) {
    return `main_w/2-overlay_w/2+(main_w/2)*(${buildTimelineExpression(frames, clip.start, 0)})`;
  }
  if (frames.length === 1) {
    return `main_w/2-overlay_w/2+(main_w/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(main_w-overlay_w)/2${formatOffsetExpression(clip.transform.x)}`;
}

export function buildOverlayYExpression(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'y');
  if (frames.length >= 2) {
    return `main_h/2-overlay_h/2+(main_h/2)*(${buildTimelineExpression(frames, clip.start, 0)})`;
  }
  if (frames.length === 1) {
    return `main_h/2-overlay_h/2+(main_h/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(main_h-overlay_h)/2${formatOffsetExpression(clip.transform.y)}`;
}
