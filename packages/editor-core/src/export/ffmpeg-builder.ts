import {
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_SUBTITLE_MODE,
  isDefaultColorCorrection,
  normalizeColorCorrection,
  normalizeMasterVolume,
  normalizeTransitionDuration,
  normalizeTransitionType,
  type ClipKeyframes,
  type Project
} from '../model';
import { cloneClipKeyframes, normalizeClipKeyframes } from '../keyframes';
import { getClipSourceVisibleDuration, getClipSpeed, getRenderableTracks, getTimelinePlaybackDuration, getTrackPan, getTrackVolume } from '../timeline';
import { round } from '../time';
import { serializeSrt } from '../subtitles/srt';
import { cssColorToFfmpeg, escapeDrawtextValue, formatFfmpegSeconds, normalizeFfmpegPath, quoteForDisplay } from './ffmpeg-escape';
import type {
  ExportClip,
  ExportClipKeyframes,
  ExportKeyframe,
  ExportProject,
  ExportSettings,
  ExportTimeline,
  ExportTrack,
  ExportTransition,
  FfmpegCapabilities,
  FfmpegExportPlan,
  FfmpegInput,
  TextArtifact
} from './export-types';

export interface BuildExportProjectOptions {
  outputPath: string;
  defaultFontPath?: string | null;
  settings?: Partial<Omit<ExportSettings, 'outputPath'>>;
}

export const DEFAULT_EXPORT_SETTINGS: Omit<ExportSettings, 'outputPath'> = {
  width: 1280,
  height: 720,
  fps: 30,
  sampleRate: 44_100,
  videoCodec: 'libx264',
  audioCodec: 'aac',
  format: 'mp4',
  videoBitrate: null,
  audioBitrate: null,
  outputMode: 'video',
  scaleMode: 'none',
  subtitleMode: undefined
};

export function buildExportProjectFromProject(project: Project, options: BuildExportProjectOptions): ExportProject {
  const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
  const duration = getTimelinePlaybackDuration(project.timeline);
  return {
    settings: {
      ...DEFAULT_EXPORT_SETTINGS,
      width: project.settings.width || DEFAULT_EXPORT_SETTINGS.width,
      height: project.settings.height || DEFAULT_EXPORT_SETTINGS.height,
      fps: project.settings.fps || DEFAULT_EXPORT_SETTINGS.fps,
      ...options.settings,
      outputPath: normalizeFfmpegPath(options.outputPath)
    },
    masterVolume: normalizeMasterVolume(project.masterVolume),
    timeline: {
      duration,
      transitions: (project.timeline.transitions ?? []).map(
        (transition) =>
          ({
            id: transition.id,
            type: normalizeTransitionType(transition.type),
            duration: normalizeTransitionDuration(transition.duration),
            fromClipId: transition.fromClipId,
            toClipId: transition.toClipId
          }) satisfies ExportTransition
      ),
      tracks: project.timeline.tracks.map((track, trackIndex) => {
        const trackVolume = getTrackVolume(track);
        const trackPan = getTrackPan(track);
        return {
          index: trackIndex,
          type: track.type,
          muted: Boolean(track.muted),
          solo: Boolean(track.solo),
          locked: Boolean(track.locked),
          volume: trackVolume,
          pan: trackPan,
          clips: track.clips.map((clip) => {
            const media = 'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined;
            return {
              id: clip.id,
              type: clip.type,
              mediaPath: media ? normalizeFfmpegPath(media.path) : null,
              start: clip.start,
              duration: clip.duration,
              trimStart: clip.trimStart,
              trimEnd: clip.trimEnd,
              speed: getClipSpeed(clip),
              sourceDuration: getClipSourceVisibleDuration(clip),
              trackIndex,
              transform: { ...clip.transform },
              colorCorrection: normalizeColorCorrection(clip.colorCorrection),
              keyframes: buildExportClipKeyframes(clip.keyframes, clip.duration, trackVolume),
              kenBurns: clip.type === 'image' ? Boolean(clip.kenBurns) : false,
              volume: ('volume' in clip ? clip.volume : 1) * trackVolume,
              pan: trackPan,
              muted: 'muted' in clip ? Boolean(clip.muted) : false,
              fadeInDuration: 'fadeInDuration' in clip ? Math.max(0, clip.fadeInDuration ?? 0) : 0,
              fadeOutDuration: 'fadeOutDuration' in clip ? Math.max(0, clip.fadeOutDuration ?? 0) : 0,
              hasEmbeddedAudio: clip.type === 'video' && Boolean(media?.hasAudio),
              audioChannels: media?.audioChannels ?? 2,
              audioSampleRate: media?.audioSampleRate ?? DEFAULT_EXPORT_SETTINGS.sampleRate,
              textStyle:
                clip.type === 'text'
                  ? {
                      text: clip.text,
                      fontSize: clip.style.fontSize,
                      fontColor: clip.style.color,
                      backgroundColor: clip.style.backgroundColor,
                      backgroundOpacity: clip.style.backgroundOpacity,
                      fontFamily: clip.style.fontFamily,
                      fontPath: options.defaultFontPath ?? null,
                      x: clip.transform.x,
                      y: clip.transform.y,
                      opacity: clip.transform.opacity,
                      bold: clip.style.bold,
                      italic: clip.style.italic
                    }
                  : null,
              subtitleStyle:
                clip.type === 'subtitle'
                  ? {
                      text: clip.text,
                      fontSize: clip.style.fontSize,
                      fontColor: clip.style.color,
                      backgroundColor: clip.style.backgroundColor,
                      backgroundOpacity: clip.style.backgroundOpacity,
                      fontFamily: clip.style.fontFamily,
                      fontPath: options.defaultFontPath ?? null,
                      x: clip.transform.x,
                      y: clip.transform.y,
                      opacity: clip.transform.opacity,
                      bold: clip.style.bold,
                      italic: clip.style.italic,
                      yOffset: clip.style.yOffset
                    }
                  : null,
              subtitleMode: clip.type === 'subtitle' ? (clip.subtitleMode ?? DEFAULT_SUBTITLE_MODE) : null
            } satisfies ExportClip;
          })
        };
      })
    }
  };
}

function buildExportClipKeyframes(keyframes: ClipKeyframes | undefined, duration: number, trackVolume: number): ExportClipKeyframes | null {
  const normalized = normalizeClipKeyframes(cloneClipKeyframes(keyframes), duration);
  if (!normalized) {
    return null;
  }
  return {
    ...normalized,
    volume: normalized.volume?.map((frame) => ({ ...frame, value: Math.min(2, Math.max(0, frame.value * trackVolume)) }))
  };
}

export function buildFfmpegExportPlan(project: ExportProject, capabilities?: FfmpegCapabilities): FfmpegExportPlan {
  const duration = Math.max(project.timeline.duration, 0.001);
  const settings = project.settings;
  const audioOnly = settings.outputMode === 'audio' || settings.format === 'm4a';
  const warnings: string[] = [];
  const inputs: FfmpegInput[] = [];
  const inputByClipId = new Map<string, number>();
  const filters: string[] = [];
  const textArtifacts: TextArtifact[] = [];
  const allClips = project.timeline.tracks.flatMap((track) => track.clips).filter((clip) => clip.duration > 0);
  const renderableTracks = getRenderableTracks({ tracks: project.timeline.tracks });
  const renderableTrackIndexes = new Set(renderableTracks.map((track) => track.index));
  const orderedClips = renderableTracks
    .flatMap((track) => track.clips)
    .filter((clip) => clip.duration > 0)
    .sort((left, right) => left.trackIndex - right.trackIndex || left.start - right.start);
  const playbackStartByClipId = buildPlaybackStartByClipId(project.timeline);
  const orderedPlaybackClips = orderedClips.map((clip) => ({
    ...clip,
    start: playbackStartByClipId.get(clip.id) ?? clip.start
  }));

  for (const clip of orderedClips) {
    if (!clip.mediaPath || clip.type === 'text' || clip.type === 'subtitle') {
      continue;
    }
    const input: FfmpegInput = {
      index: inputs.length,
      path: normalizeFfmpegPath(clip.mediaPath),
      args: buildInputArgs(clip)
    };
    inputs.push(input);
    inputByClipId.set(clip.id, input.index);
  }

  if (allClips.length === 0) {
    throw new Error('The timeline is empty. Add media or text clips before exporting.');
  }

  let currentVideo = 'base0';
  let videoStep = 0;

  if (!audioOnly) {
    filters.push(`color=c=black:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(duration)}[base0]`);

    const visualItems = buildVisualItems(project.timeline, orderedPlaybackClips, playbackStartByClipId, renderableTrackIndexes, inputByClipId, settings, filters, warnings);

    for (const item of visualItems) {
      if (item.kind === 'text') {
        if (capabilities && (!capabilities.hasDrawtext || !capabilities.hasLibfreetype)) {
          warnings.push(capabilities.drawtextWarning ?? `Text clip ${item.clip.id} was skipped because FFmpeg drawtext/libfreetype is unavailable.`);
          continue;
        }
        const nextVideo = `base${videoStep + 1}`;
        const { filter, artifact } = buildTextFilter(currentVideo, nextVideo, item.clip);
        filters.push(filter);
        textArtifacts.push(artifact);
        currentVideo = nextVideo;
        videoStep += 1;
        continue;
      }

      const nextVideo = `base${videoStep + 1}`;
      filters.push(
        `[${currentVideo}][${item.label}]overlay=x='${item.xExpression}':y='${item.yExpression}':eval=frame:enable='between(t,${formatFfmpegSeconds(
          item.start
        )},${formatFfmpegSeconds(item.start + item.duration)})'[${nextVideo}]`
      );
      currentVideo = nextVideo;
      videoStep += 1;
    }
  }

  const subtitleClips = orderedPlaybackClips.filter((clip) => clip.type === 'subtitle' && clip.subtitleStyle && clip.textStyle === null);
  const subtitleMode = settings.subtitleMode ?? subtitleClips.find((clip) => clip.subtitleMode)?.subtitleMode ?? DEFAULT_SUBTITLE_MODE;
  let softSubtitleInputIndex: number | undefined;
  if (!audioOnly && subtitleClips.length > 0 && subtitleMode === 'burn-in') {
    const nextVideo = `base${videoStep + 1}`;
    const { filter, artifact } = buildSubtitleBurnInFilter(currentVideo, nextVideo, subtitleClips);
    filters.push(filter);
    textArtifacts.push(artifact);
    currentVideo = nextVideo;
    videoStep += 1;
  } else if (!audioOnly && subtitleClips.length > 0 && subtitleMode === 'soft-sub') {
    const artifact = buildSubtitleArtifact(subtitleClips, 'argument');
    softSubtitleInputIndex = inputs.length;
    inputs.push({
      index: softSubtitleInputIndex,
      path: artifact.placeholder,
      args: ['-f', 'srt']
    });
    textArtifacts.push(artifact);
  }

  if (!audioOnly) {
    filters.push(`[${currentVideo}]trim=duration=${formatFfmpegSeconds(duration)},setpts=PTS-STARTPTS,fps=${settings.fps},format=yuv420p[vout]`);
  }

  const masterVolume = normalizeMasterVolume(project.masterVolume);
  const audioLabels = buildAudioFilters(orderedPlaybackClips, inputByClipId, settings, filters);
  if (audioLabels.length === 0) {
    filters.push(`anullsrc=channel_layout=stereo:sample_rate=${settings.sampleRate}:d=${formatFfmpegSeconds(duration)},volume=${formatVolume(masterVolume)}[aout]`);
  } else {
    filters.push(
      `${audioLabels.map((label) => `[${label}]`).join('')}amix=inputs=${audioLabels.length}:duration=longest:normalize=0,atrim=duration=${formatFfmpegSeconds(
        duration
      )},asetpts=PTS-STARTPTS,aresample=${settings.sampleRate},volume=${formatVolume(masterVolume)}[aout]`
    );
  }

  const filterComplex = filters.join(';');
  const maps = audioOnly ? ['-map', '[aout]'] : ['-map', '[vout]', '-map', '[aout]'];
  const subtitleOutputArgs: string[] = [];
  if (softSubtitleInputIndex !== undefined) {
    maps.push('-map', `${softSubtitleInputIndex}:s:0`);
    subtitleOutputArgs.push('-c:s', 'mov_text');
  }
  const outputArgs = [
    ...(audioOnly
      ? []
      : ['-c:v', settings.videoCodec, ...buildBitrateArgs('-b:v', settings.videoBitrate), '-pix_fmt', 'yuv420p', '-r', String(settings.fps)]),
    '-c:a',
    settings.audioCodec,
    ...buildBitrateArgs('-b:a', settings.audioBitrate),
    ...subtitleOutputArgs,
    '-t',
    formatFfmpegSeconds(duration),
    ...buildContainerArgs(settings),
    normalizeFfmpegPath(settings.outputPath)
  ];
  const fullArgs = [
    '-y',
    '-progress',
    'pipe:2',
    '-nostats',
    ...inputs.flatMap((input) => [...input.args, '-i', input.path]),
    '-filter_complex',
    filterComplex,
    ...maps,
    ...outputArgs
  ];

  return {
    inputs,
    filterComplex,
    maps,
    outputArgs,
    fullArgs,
    warnings,
    textArtifacts,
    displayCommand: ['ffmpeg', ...fullArgs.map(quoteForDisplay)].join(' '),
    duration
  };
}

type VisualItem =
  | {
      kind: 'text';
      trackIndex: number;
      start: number;
      duration: number;
      clip: ExportClip;
    }
  | {
      kind: 'media';
      trackIndex: number;
      start: number;
      duration: number;
      label: string;
      xExpression: string;
      yExpression: string;
    };

function buildVisualItems(
  timeline: ExportTimeline,
  orderedPlaybackClips: ExportClip[],
  playbackStartByClipId: Map<string, number>,
  renderableTrackIndexes: Set<number>,
  inputByClipId: Map<string, number>,
  settings: ExportSettings,
  filters: string[],
  warnings: string[]
): VisualItem[] {
  const consumedClipIds = new Set<string>();
  const items: VisualItem[] = [];

  for (const transition of timeline.transitions) {
    const pair = findExportTransitionPair(timeline, transition);
    if (!pair || !renderableTrackIndexes.has(pair.track.index)) {
      continue;
    }
    if (!isTransitionVisualClip(pair.fromClip) || !isTransitionVisualClip(pair.toClip)) {
      warnings.push(`Transition ${transition.id} was skipped because both clips must be visual media clips.`);
      continue;
    }
    if (consumedClipIds.has(pair.fromClip.id) || consumedClipIds.has(pair.toClip.id)) {
      warnings.push(`Transition ${transition.id} was skipped because chained transitions are not yet supported in one export segment.`);
      continue;
    }
    const fromInput = inputByClipId.get(pair.fromClip.id);
    const toInput = inputByClipId.get(pair.toClip.id);
    if (fromInput === undefined || toInput === undefined) {
      warnings.push(`Transition ${transition.id} was skipped because one of its clips has no media input.`);
      continue;
    }
    const duration = clampExportTransitionDuration(transition, pair.fromClip, pair.toClip);
    if (duration <= 0) {
      continue;
    }
    const label = `xfade${safeLabel(transition.id)}`;
    const start = playbackStartByClipId.get(pair.fromClip.id) ?? pair.fromClip.start;
    const pairDuration = round(pair.fromClip.duration + pair.toClip.duration - duration);
    filters.push(buildTransitionClipFilter(fromInput, pair.fromClip, `${label}_from`, settings));
    filters.push(buildTransitionClipFilter(toInput, pair.toClip, `${label}_to`, settings));
    filters.push(
      `[${label}_from][${label}_to]xfade=transition=${mapTransitionType(transition.type)}:duration=${formatFfmpegSeconds(
        duration
      )}:offset=${formatFfmpegSeconds(Math.max(0, pair.fromClip.duration - duration))}[${label}_raw]`
    );
    filters.push(`[${label}_raw]setpts=PTS-STARTPTS+${formatFfmpegSeconds(start)}/TB[${label}]`);
    items.push({
      kind: 'media',
      trackIndex: pair.track.index,
      start,
      duration: pairDuration,
      label,
      xExpression: '(main_w-overlay_w)/2+0',
      yExpression: '(main_h-overlay_h)/2+0'
    });
    consumedClipIds.add(pair.fromClip.id);
    consumedClipIds.add(pair.toClip.id);
  }

  for (const clip of orderedPlaybackClips.filter((item) => item.type === 'video' || item.type === 'image' || item.type === 'text')) {
    if (consumedClipIds.has(clip.id)) {
      continue;
    }
    if (clip.type === 'text') {
      items.push({ kind: 'text', trackIndex: clip.trackIndex, start: clip.start, duration: clip.duration, clip });
      continue;
    }

    const inputIndex = inputByClipId.get(clip.id);
    if (inputIndex === undefined) {
      warnings.push(`Clip ${clip.id} has no media path and was skipped.`);
      continue;
    }
    const clipLabel = `v${safeLabel(clip.id)}`;
    filters.push(buildVisualClipFilter(inputIndex, clip, clipLabel, settings));
    items.push({
      kind: 'media',
      trackIndex: clip.trackIndex,
      start: clip.start,
      duration: clip.duration,
      label: clipLabel,
      xExpression: buildOverlayXExpression(clip),
      yExpression: buildOverlayYExpression(clip)
    });
  }

  return items.sort((left, right) => left.trackIndex - right.trackIndex || left.start - right.start || visualKindOrder(left) - visualKindOrder(right));
}

function buildPlaybackStartByClipId(timeline: ExportTimeline): Map<string, number> {
  const starts = new Map<string, number>();
  for (const track of timeline.tracks) {
    let transitionOffset = 0;
    const clips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    for (let index = 0; index < clips.length; index += 1) {
      const clip = clips[index];
      const previous = clips[index - 1];
      const transition = previous ? timeline.transitions.find((item) => item.fromClipId === previous.id && item.toClipId === clip.id) : undefined;
      if (previous && transition && areExportClipsAdjacent(previous, clip)) {
        transitionOffset = round(transitionOffset + clampExportTransitionDuration(transition, previous, clip));
      }
      starts.set(clip.id, round(clip.start - transitionOffset));
    }
  }
  return starts;
}

function findExportTransitionPair(
  timeline: ExportTimeline,
  transition: ExportTransition
): { track: ExportTrack; fromClip: ExportClip; toClip: ExportClip } | undefined {
  for (const track of timeline.tracks) {
    const clips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    const fromIndex = clips.findIndex((clip) => clip.id === transition.fromClipId);
    const toIndex = clips.findIndex((clip) => clip.id === transition.toClipId);
    if (fromIndex === -1 || toIndex !== fromIndex + 1) {
      continue;
    }
    const fromClip = clips[fromIndex];
    const toClip = clips[toIndex];
    if (!areExportClipsAdjacent(fromClip, toClip)) {
      continue;
    }
    return { track, fromClip, toClip };
  }
  return undefined;
}

function buildTransitionClipFilter(inputIndex: number, clip: ExportClip, label: string, settings: ExportSettings): string {
  const sourceDuration = getExportClipSourceDuration(clip);
  const trim = clip.type === 'video' ? `trim=start=0:duration=${formatFfmpegSeconds(sourceDuration)}` : `trim=duration=${formatFfmpegSeconds(sourceDuration)}`;
  const filters = [
    `[${inputIndex}:v]${trim}`,
    buildSetptsFilter(clip, false),
    `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
    `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    `fps=${settings.fps}`,
    'format=rgba'
  ];
  filters.push(...buildColorCorrectionFilters(clip));
  filters.push(`colorchannelmixer=aa=${formatOpacity(clip.transform.opacity)}[${label}]`);
  return filters.join(',');
}

function isTransitionVisualClip(clip: ExportClip): boolean {
  return clip.type === 'video' || clip.type === 'image';
}

function areExportClipsAdjacent(fromClip: ExportClip, toClip: ExportClip): boolean {
  return Math.abs(fromClip.start + fromClip.duration - toClip.start) <= 0.001;
}

function clampExportTransitionDuration(transition: ExportTransition, fromClip: ExportClip, toClip: ExportClip): number {
  return round(Math.min(normalizeTransitionDuration(transition.duration), Math.max(0, Math.min(fromClip.duration, toClip.duration) * 0.5)));
}

function mapTransitionType(type: ExportTransition['type']): string {
  return type === 'fade-black' ? 'fadeblack' : 'dissolve';
}

function visualKindOrder(item: VisualItem): number {
  return item.kind === 'media' ? 0 : 1;
}

function buildVisualClipFilter(inputIndex: number, clip: ExportClip, label: string, settings: ExportSettings): string {
  const sourceDuration = getExportClipSourceDuration(clip);
  const trim = clip.type === 'video' ? `trim=start=0:duration=${formatFfmpegSeconds(sourceDuration)}` : `trim=duration=${formatFfmpegSeconds(sourceDuration)}`;
  const filters = [`[${inputIndex}:v]${trim}`];
  if (isKenBurnsAnimatedScaleClip(clip)) {
    filters.push(buildSetptsFilter(clip, false), buildKenBurnsZoompanFilter(clip, settings), 'setsar=1', buildSetptsFilter(clip, true));
  } else {
    filters.push(buildSetptsFilter(clip, true), buildScaleFilter(clip), 'setsar=1');
  }
  if (settings.scaleMode === 'fit') {
    filters.push(
      `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
      `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`
    );
  }
  filters.push('format=rgba');
  filters.push(...buildColorCorrectionFilters(clip));
  if (Math.abs(clip.transform.rotation) > 0.001) {
    filters.push(`rotate=${((clip.transform.rotation * Math.PI) / 180).toFixed(6)}:c=none`);
  }
  filters.push(...buildOpacityFilters(clip, label));
  return filters.join(',');
}

function isKenBurnsAnimatedScaleClip(clip: ExportClip): boolean {
  return clip.type === 'image' && clip.kenBurns && (getAnimatedFrames(clip, 'scaleX').length >= 2 || getAnimatedFrames(clip, 'scaleY').length >= 2);
}

function buildSetptsFilter(clip: ExportClip, includeStartOffset: boolean): string {
  const startOffset = `${formatFfmpegSeconds(clip.start)}/TB`;
  if (Math.abs(clip.speed - 1) < 0.001 || clip.type === 'image') {
    return includeStartOffset ? `setpts=PTS-STARTPTS+${startOffset}` : 'setpts=PTS-STARTPTS';
  }
  return includeStartOffset ? `setpts=(PTS-STARTPTS)/${formatFfmpegSeconds(clip.speed)}+${startOffset}` : `setpts=(PTS-STARTPTS)/${formatFfmpegSeconds(clip.speed)}`;
}

function buildScaleFilter(clip: ExportClip): string {
  const scaleX = getAnimatedFrames(clip, 'scaleX');
  const scaleY = getAnimatedFrames(clip, 'scaleY');
  if (scaleX.length >= 2 || scaleY.length >= 2) {
    const xExpression = buildTimelineExpression(scaleX, clip.start, clip.transform.scale);
    const yExpression = buildTimelineExpression(scaleY, clip.start, clip.transform.scale);
    return `scale=w='trunc(iw*(${xExpression})/2)*2':h='trunc(ih*(${yExpression})/2)*2':eval=frame`;
  }
  const staticScale = scaleX.length === 1 && scaleY.length === 1 ? (scaleX[0].value + scaleY[0].value) / 2 : clip.transform.scale;
  return `scale=trunc(iw*${formatScale(staticScale)}/2)*2:trunc(ih*${formatScale(staticScale)}/2)*2`;
}

function buildKenBurnsZoompanFilter(clip: ExportClip, settings: ExportSettings): string {
  const scaleX = getAnimatedFrames(clip, 'scaleX');
  const scaleY = getAnimatedFrames(clip, 'scaleY');
  const zoomFrames = scaleX.length >= 2 ? scaleX : scaleY;
  const zoomExpression = buildTimelineExpression(zoomFrames, 0, clip.transform.scale, 'ot');
  return `zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=2:s=${settings.width}x${settings.height}:fps=${settings.fps}`;
}

function buildOpacityFilters(clip: ExportClip, label: string): string[] {
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
      return [`colorchannelmixer=aa=1`, `fade=t=in:st=${formatFfmpegSeconds(start)}:d=${formatFfmpegSeconds(duration)}:alpha=1[${label}]`];
    }
    if (first.value >= 0.999 && second.value <= 0.001) {
      return [`colorchannelmixer=aa=1`, `fade=t=out:st=${formatFfmpegSeconds(start)}:d=${formatFfmpegSeconds(duration)}:alpha=1[${label}]`];
    }
  }
  const expression = buildTimelineExpression(frames, clip.start, clip.transform.opacity, 'T');
  return [`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${expression})'[${label}]`];
}

function buildOverlayXExpression(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'x');
  if (frames.length >= 2) {
    return `main_w/2-overlay_w/2+(main_w/2)*(${buildTimelineExpression(frames, clip.start, 0)})`;
  }
  if (frames.length === 1) {
    return `main_w/2-overlay_w/2+(main_w/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(main_w-overlay_w)/2+${formatSigned(clip.transform.x)}`;
}

function buildOverlayYExpression(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'y');
  if (frames.length >= 2) {
    return `main_h/2-overlay_h/2+(main_h/2)*(${buildTimelineExpression(frames, clip.start, 0)})`;
  }
  if (frames.length === 1) {
    return `main_h/2-overlay_h/2+(main_h/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(main_h-overlay_h)/2+${formatSigned(clip.transform.y)}`;
}

function buildColorCorrectionFilters(clip: ExportClip): string[] {
  const colorCorrection = normalizeColorCorrection(clip.colorCorrection);
  if (isDefaultColorCorrection(colorCorrection)) {
    return [];
  }
  const filters: string[] = [];
  const hasBasicCorrection =
    colorCorrection.brightness !== DEFAULT_COLOR_CORRECTION.brightness ||
    colorCorrection.contrast !== DEFAULT_COLOR_CORRECTION.contrast ||
    colorCorrection.saturation !== DEFAULT_COLOR_CORRECTION.saturation ||
    Math.abs(colorCorrection.hue) > 0.001;
  if (hasBasicCorrection) {
    filters.push(
      `eq=brightness=${formatFfmpegNumber(colorCorrection.brightness)}:contrast=${formatFfmpegNumber(
        colorCorrection.contrast
      )}:saturation=${formatFfmpegNumber(colorCorrection.saturation)}`
    );
  }
  if (Math.abs(colorCorrection.hue) > 0.001) {
    filters.push(`hue=h=${formatFfmpegNumber(colorCorrection.hue)}`);
  }
  if (colorCorrection.lutPath) {
    filters.push(`lut3d=file=${escapeDrawtextValue(colorCorrection.lutPath)}`);
  }
  return filters;
}

function buildInputArgs(clip: ExportClip): string[] {
  if (clip.type === 'image') {
    return ['-loop', '1', '-t', formatFfmpegSeconds(clip.duration)];
  }
  if (clip.type === 'video' || clip.type === 'audio') {
    return ['-ss', formatFfmpegSeconds(clip.trimStart), '-t', formatFfmpegSeconds(getExportClipSourceDuration(clip))];
  }
  return [];
}

function buildBitrateArgs(flag: '-b:v' | '-b:a', bitrate: string | null | undefined): string[] {
  const value = bitrate?.trim();
  return value ? [flag, value] : [];
}

function buildContainerArgs(settings: ExportSettings): string[] {
  const format = settings.format.toLowerCase();
  if (settings.outputMode === 'audio' || format === 'm4a') {
    return [];
  }
  if (format === 'mp4' || format === 'mov') {
    return ['-movflags', '+faststart'];
  }
  return [];
}

function getExportClipSourceDuration(clip: ExportClip): number {
  return clip.type === 'video' || clip.type === 'audio' ? Math.max(0.001, clip.sourceDuration) : Math.max(0.001, clip.duration);
}

function buildTextFilter(inputLabel: string, outputLabel: string, clip: ExportClip): { filter: string; artifact: TextArtifact } {
  const safeId = safeLabel(clip.id);
  const placeholder = `__TEXTFILE_${safeId}__`;
  const artifact: TextArtifact = {
    clipId: clip.id,
    text: clip.textStyle?.text ?? '',
    fileName: `${safeId}.txt`,
    placeholder
  };
  const style = clip.textStyle;
  const fontPath = style?.fontPath ? `:fontfile=${escapeDrawtextValue(style.fontPath)}` : '';
  const fontColor = cssColorToFfmpeg(style?.fontColor ?? 'white');
  const backgroundColor = cssColorToFfmpeg(style?.backgroundColor ?? 'black');
  const backgroundOpacity = formatOpacity(style?.backgroundOpacity ?? 0);
  const fontSize = Math.max(1, Math.round(style?.fontSize ?? 48));
  const alpha = formatOpacity(style?.opacity ?? clip.transform.opacity);
  return {
    artifact,
    filter: `[${inputLabel}]drawtext=textfile=${placeholder}${fontPath}:fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2+${formatSigned(
      style?.x ?? clip.transform.x
    )}:y=(h-text_h)/2+${formatSigned(
      style?.y ?? clip.transform.y
    )}:alpha=${alpha}:box=1:boxcolor=${backgroundColor}@${backgroundOpacity}:boxborderw=${Math.max(
      0,
      Math.round(fontSize * 0.25)
    )}:enable='between(t,${formatFfmpegSeconds(
      clip.start
    )},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`
  };
}

function buildSubtitleBurnInFilter(inputLabel: string, outputLabel: string, clips: ExportClip[]): { filter: string; artifact: TextArtifact } {
  const artifact = buildSubtitleArtifact(clips, 'filter');
  const style = clips.find((clip) => clip.subtitleStyle)?.subtitleStyle;
  const forceStyle = [
    `FontSize=${Math.max(1, Math.round(style?.fontSize ?? 42))}`,
    `PrimaryColour=${cssColorToAssColor(style?.fontColor ?? '#ffffff')}`,
    `BackColour=${cssColorToAssColor(style?.backgroundColor ?? '#000000', style?.backgroundOpacity ?? 0)}`,
    'BorderStyle=3',
    'Outline=0',
    'Shadow=0',
    'Alignment=2',
    `MarginV=${Math.max(0, Math.round(style?.yOffset ?? 72))}`
  ].join(',');
  return {
    artifact,
    filter: `[${inputLabel}]subtitles=filename=${artifact.placeholder}:force_style='${forceStyle}'[${outputLabel}]`
  };
}

function buildSubtitleArtifact(clips: ExportClip[], pathMode: TextArtifact['pathMode']): TextArtifact {
  const cues = clips
    .filter((clip) => clip.duration > 0 && (clip.subtitleStyle?.text ?? '').trim().length > 0)
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id))
    .map((clip) => ({
      startMs: Math.round(Math.max(0, clip.start) * 1000),
      endMs: Math.round(Math.max(0, clip.start + clip.duration) * 1000),
      text: clip.subtitleStyle?.text ?? ''
    }));
  return {
    clipId: 'subtitles',
    text: serializeSrt(cues),
    fileName: 'subtitles.srt',
    placeholder: '__SUBTITLEFILE_export_subtitles__',
    pathMode
  };
}

function buildAudioFilters(
  clips: ExportClip[],
  inputByClipId: Map<string, number>,
  settings: ExportSettings,
  filters: string[]
): string[] {
  const labels: string[] = [];
  for (const clip of clips.filter((item) => item.type === 'audio' || (item.type === 'video' && item.hasEmbeddedAudio))) {
    if (clip.muted || clip.volume <= 0) {
      continue;
    }
    const inputIndex = inputByClipId.get(clip.id);
    if (inputIndex === undefined) {
      continue;
    }
    const label = `${clip.type === 'video' ? 'av' : 'a'}${safeLabel(clip.id)}`;
    const delay = Math.max(0, Math.round(clip.start * 1000));
    const speedFilters = buildAtempoFilters(clip.speed);
    const fadeFilters = buildAudioFadeFilters(clip);
    filters.push(
      `[${inputIndex}:a:0]atrim=start=0:duration=${formatFfmpegSeconds(
        getExportClipSourceDuration(clip)
      )},asetpts=PTS-STARTPTS${speedFilters.length > 0 ? `,${speedFilters.join(',')}` : ''}${fadeFilters},adelay=${delay}:all=1,${buildVolumeFilter(
        clip
      )}${buildPanFilter(clip)},aformat=channel_layouts=stereo,aresample=${settings.sampleRate}[${label}]`
    );
    labels.push(label);
  }
  return labels;
}

function buildPanFilter(clip: ExportClip): string {
  if (Math.abs(clip.pan) < 0.001) {
    return '';
  }
  return `,stereopan=pan=${formatPan(clip.pan)}`;
}

function buildAudioFadeFilters(clip: ExportClip): string {
  const filters: string[] = [];
  if (clip.fadeInDuration > 0) {
    filters.push(`afade=t=in:st=0:d=${formatFfmpegSeconds(Math.min(clip.fadeInDuration, clip.duration))}`);
  }
  if (clip.fadeOutDuration > 0) {
    const duration = Math.min(clip.fadeOutDuration, clip.duration);
    filters.push(`afade=t=out:st=${formatFfmpegSeconds(Math.max(0, clip.duration - duration))}:d=${formatFfmpegSeconds(duration)}`);
  }
  return filters.length > 0 ? `,${filters.join(',')}` : '';
}

function buildVolumeFilter(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'volume');
  if (frames.length >= 2) {
    return `volume='${buildLocalExpression(frames, clip.volume)}':eval=frame`;
  }
  if (frames.length === 1) {
    return `volume=${formatVolume(frames[0].value)}`;
  }
  return `volume=${formatVolume(clip.volume)}`;
}

export function buildAtempoFilters(speed: number): string[] {
  let remaining = getClipSpeed({ speed });
  const filters: string[] = [];
  while (remaining < 0.5 - 0.0001) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  while (remaining > 2 + 0.0001) {
    filters.push('atempo=2.0');
    remaining /= 2;
  }
  if (Math.abs(remaining - 1) >= 0.0001) {
    filters.push(`atempo=${formatAtempo(remaining)}`);
  }
  return filters;
}

type AnimatedProperty = keyof NonNullable<ExportClip['keyframes']>;

function getAnimatedFrames(clip: ExportClip, property: AnimatedProperty): ExportKeyframe[] {
  return [...(clip.keyframes?.[property] ?? [])].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

function buildLocalExpression(frames: Array<{ time: number; value: number; easing?: ExportKeyframe['easing'] }>, fallback: number, variable = 't'): string {
  if (frames.length < 2) {
    return formatFfmpegNumber(frames[0]?.value ?? fallback);
  }
  const first = frames[0];
  const last = frames[frames.length - 1];
  let expression = formatFfmpegNumber(last.value);
  for (let index = frames.length - 2; index >= 0; index -= 1) {
    const left = frames[index];
    const right = frames[index + 1];
    expression = `if(lte(${variable},${formatFfmpegSeconds(right.time)}),${buildSegmentExpression(left, right, variable)},${expression})`;
  }
  return `if(lt(${variable},${formatFfmpegSeconds(first.time)}),${formatFfmpegNumber(first.value)},${expression})`;
}

function buildTimelineExpression(frames: Array<{ time: number; value: number; easing?: ExportKeyframe['easing'] }>, clipStart: number, fallback: number, variable = 't'): string {
  if (frames.length < 2) {
    return formatFfmpegNumber(frames[0]?.value ?? fallback);
  }
  const shifted = frames.map((frame) => ({ ...frame, time: clipStart + frame.time }));
  return buildLocalExpression(shifted, fallback, variable);
}

function buildSegmentExpression(
  left: { time: number; value: number; easing?: ExportKeyframe['easing'] },
  right: { time: number; value: number },
  variable: string
): string {
  const start = formatFfmpegSeconds(left.time);
  const startValue = formatFfmpegNumber(left.value);
  const endValue = formatFfmpegNumber(right.value);
  const span = formatFfmpegSeconds(Math.max(0.001, right.time - left.time));
  const progress = `((${variable}-${start})/${span})`;
  return `${startValue}+(${endValue}-${startValue})*${buildEasingExpression(progress, left.easing ?? 'linear')}`;
}

function buildEasingExpression(progress: string, easing: ExportKeyframe['easing']): string {
  if (easing === 'ease-in') {
    return `(${progress})*(${progress})`;
  }
  if (easing === 'ease-out') {
    return `1-(1-(${progress}))*(1-(${progress}))`;
  }
  if (easing === 'ease-in-out') {
    return `if(lt(${progress},0.5),2*(${progress})*(${progress}),1-pow(-2*(${progress})+2,2)/2)`;
  }
  return progress;
}

function formatAtempo(value: number): string {
  const fixed = value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return fixed.includes('.') ? fixed : `${fixed}.0`;
}

function formatFfmpegNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/g, '').replace(/\.$/g, '');
}

function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

function formatScale(value: number): string {
  return formatFfmpegSeconds(Math.max(0.01, value || 1));
}

function formatOpacity(value: number): string {
  return formatFfmpegSeconds(Math.min(1, Math.max(0, value)));
}

function formatVolume(value: number): string {
  return formatFfmpegSeconds(Math.min(4, Math.max(0, value)));
}

function formatPan(value: number): string {
  return formatFfmpegNumber(Math.min(1, Math.max(-1, value)));
}

function formatSigned(value: number): string {
  const formatted = formatFfmpegSeconds(Math.abs(value));
  return value < 0 ? `-${formatted}` : formatted;
}

function cssColorToAssColor(value: string, opacity?: number): string {
  const match = /^#?([a-fA-F0-9]{6})$/.exec(value.trim());
  const hex = match ? match[1] : 'ffffff';
  const red = hex.slice(0, 2);
  const green = hex.slice(2, 4);
  const blue = hex.slice(4, 6);
  if (opacity === undefined) {
    return `&H${blue}${green}${red}&`;
  }
  const alpha = Math.round((1 - Math.min(1, Math.max(0, opacity))) * 255)
    .toString(16)
    .padStart(2, '0');
  return `&H${alpha}${blue}${green}${red}&`;
}
