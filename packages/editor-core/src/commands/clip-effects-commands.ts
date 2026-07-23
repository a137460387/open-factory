import { createId, createMask, createTransition, normalizeColorCorrection, normalizeClipBorder, normalizeFrameInterpolation, normalizeMask, normalizeMasks, normalizeMotionTrack, normalizeStabilization, normalizeTransform, normalizeVideoRestoration, normalizeAudioDenoise, normalizeAudioPitchSemitones, normalizeAudioFadeCurve, normalizeAudioFadeDuration, normalizeAudioChannelRouting, normalizeClipProjection, normalizeClipPanoramaView, normalizeQualityEnhancement, normalizeSequenceFrameRate, normalizeSlowMotionMode, normalizeClipBeatMarkers, normalizeDetectedBpm, normalizeClipSceneCuts, normalizeTextPath, normalizeSubtitleTrackType, normalizeSubtitleSpeaker, normalizeSubtitleSoundDesc, type AudioFadeCurve, type Clip, type ClipBorder, type ClipGroup, type ClipGroupColor, type ClipKeyframes, type ClipMask, type ClipStabilization, type ClipAudioDenoise, type ClipFrameInterpolation, type ClipQualityEnhancement, type ClipProjection, type ClipPanoramaView, type ClipVideoRestoration, type ChromaKey, type ColorCorrection, type KeyframeProperty, type MotionTrackPoint, type Project, type SubtitleMode, type SubtitleTrackType, type SubtitleStyle, type TextPathOptions, type TextStyle, type Timeline, type Track, type Transition, type TransitionType, type Transform, replaceProjectActiveTimeline } from '../model';
import { detectOverlap, findAdjacentTransitionClips, getClipDisplayDuration, getClipSourceVisibleDuration, getClipSpeed, getTimelineDuration, replaceClip, clampTransitionDuration } from '../timeline';
import { round } from '../time';
import { cloneClipKeyframes, normalizeClipKeyframes } from '../keyframes';
import { cloneEffects, normalizeEffect, normalizeEffects, type Effect, type EffectParams, type EffectType } from '../effects';
import { buildEffectPresetClipPatch, type EffectPreset } from '../effect-presets';
import { normalizeClipBlendMode } from '../blend-modes';
import { normalizeClipContentAnalysis } from '../content-analysis';
import { normalizeClipPitchData } from '../audio-pitch';
import { normalizeDataSubtitleSource } from '../data-subtitle';
import { normalizeSpatialAudio, type ClipSpatialAudio } from '../spatial-audio';
import { normalizeTimelineLabelColor, type TimelineLabelColor } from '../timeline-color-labels';
import { type ClipGroupBatchPatch, createClipGroup, normalizeClipGroups, removeClipIdsFromGroups } from '../clip-groups';
import { applyStyleToClip, type ApplyStyleTransferOptions, type StyleSummary } from '../style-transfer';
import { normalizeCreditsRollSpeed, normalizeCreditsRows, normalizeCreditsStyle, type CreditsRow, type CreditsStyle } from '../credits-roll';
import { normalizeMotionGraphic } from '../motion-graphics';
import { normalizeRichTextDocument, normalizeTextArc, normalizeTextLayout, normalizeTextOpenTypeFeatures } from '../text-layout';
import type { ColorGradingGraph, ColorGradingNode, ColorGradingConnection } from '../color-grading/types';
import { createEmptyColorGradingGraph } from '../color-grading/types';
import type { Command } from './command';
import { type TimelineAccessor, type ProjectAccessor, assertClipsNotOnLockedTrack, findClip, findTrack, timelineHasOverlaps, getProjectActiveClipIds, touchProject, applyClipGroupBatchPatch, mergeChromaKeyPatch, removeClipsFromTimeline } from './helpers';

export interface CreateClipGroupOptions {
  id?: string;
  name?: string;
  color?: ClipGroupColor;
}

export class CreateClipGroupCommand implements Command {
  readonly description = 'Create clip group';
  private before?: Project;
  group?: ClipGroup;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipIds: string[],
    private readonly options: CreateClipGroupOptions = {},
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const uniqueClipIds = Array.from(new Set(this.clipIds)).filter((clipId) => activeClipIds.includes(clipId));
    this.group ??= createClipGroup({ ...this.options, clipIds: uniqueClipIds }, activeClipIds);
    const withoutGroupedClips = removeClipIdsFromGroups(project.clipGroups, this.group.clipIds);
    this.accessor.setProject(
      touchProject({
        ...project,
        clipGroups: normalizeClipGroups([...withoutGroupedClips, this.group], activeClipIds),
      }),
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateClipGroupCommand implements Command {
  readonly description = 'Update clip group';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly groupId: string,
    private readonly patch: Partial<Pick<ClipGroup, 'name' | 'color'>>,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    if (!groups.some((group) => group.id === this.groupId)) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    this.accessor.setProject(
      touchProject({
        ...project,
        clipGroups: normalizeClipGroups(
          groups.map((group) => (group.id === this.groupId ? { ...group, ...this.patch } : group)),
          activeClipIds,
        ),
      }),
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UngroupCommand implements Command {
  readonly description = 'Ungroup clips';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly groupId: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    if (!groups.some((group) => group.id === this.groupId)) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    this.accessor.setProject(
      touchProject({
        ...project,
        clipGroups: groups.filter((group) => group.id !== this.groupId),
      }),
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class DeleteGroupCommand implements Command {
  readonly description = 'Delete clip group';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly groupId: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    const group = groups.find((item) => item.id === this.groupId);
    if (!group) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    const ids = new Set(group.clipIds);
    const timeline = removeClipsFromTimeline(project.timeline, ids);
    this.accessor.setProject(
      touchProject({
        ...replaceProjectActiveTimeline(project, timeline),
        clipGroups: groups.filter((item) => item.id !== group.id),
      }),
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class BatchUpdateClipGroupClipsCommand implements Command {
  readonly description = 'Batch update clip group clips';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly groupId: string,
    private readonly patch: ClipGroupBatchPatch,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    const group = groups.find((item) => item.id === this.groupId);
    if (!group) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    const ids = new Set(group.clipIds);
    const nextTimeline: Timeline = {
      ...project.timeline,
      tracks: project.timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (ids.has(clip.id) ? applyClipGroupBatchPatch(clip, this.patch) : clip)),
      })),
    };
    if (timelineHasOverlaps(nextTimeline)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setProject(
      touchProject({
        ...replaceProjectActiveTimeline(project, nextTimeline),
        clipGroups: groups,
      }),
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface ApplyStyleCommandOptions extends ApplyStyleTransferOptions {
  clipIds?: string[];
}

export class ApplyStyleCommand implements Command {
  readonly description = 'Apply style transfer';
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly summary: StyleSummary,
    private readonly options: ApplyStyleCommandOptions,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    const targetIds = this.options.clipIds?.length ? new Set(this.options.clipIds) : undefined;
    let applied = 0;
    const nextTimeline: Timeline = {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (targetIds && !targetIds.has(clip.id)) {
            return clip;
          }
          applied += 1;
          return applyStyleToClip(clip, this.summary, this.options);
        }),
      })),
    };
    if (targetIds && applied === 0) {
      throw new Error('No clips match style transfer target');
    }
    this.accessor.setTimeline(nextTimeline);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export interface TransitionInput {
  id?: string;
  type: TransitionType;
  duration: number;
  fromClipId: string;
  toClipId: string;
}

export class AddTransitionCommand implements Command {
  readonly description = 'Add transition';
  private transition?: Transition;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly input: TransitionInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const pair = findAdjacentTransitionClips(timeline, this.input.fromClipId, this.input.toClipId);
    if (!pair) {
      throw new Error('Transition clips must be adjacent on the same track');
    }
    if (
      (timeline.transitions ?? []).some(
        (transition) => transition.fromClipId === this.input.fromClipId && transition.toClipId === this.input.toClipId,
      )
    ) {
      throw new Error('Transition already exists for these clips');
    }
    const duration = clampTransitionDuration(this.input.duration, pair.fromClip, pair.toClip);
    if (duration <= 0) {
      throw new Error('Transition duration must be greater than zero');
    }
    this.transition ??= createTransition({ ...this.input, duration });
    this.transition = { ...this.transition, duration };
    this.accessor.setTimeline({
      ...timeline,
      transitions: [...(timeline.transitions ?? []), this.transition],
    });
  }

  undo(): void {
    if (!this.transition) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      transitions: (timeline.transitions ?? []).filter((transition) => transition.id !== this.transition?.id),
    });
  }
}

export class RemoveTransitionCommand implements Command {
  readonly description = 'Remove transition';
  private removed?: Transition;
  private index = -1;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly transitionId: string,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.index = (timeline.transitions ?? []).findIndex((transition) => transition.id === this.transitionId);
    if (this.index === -1) {
      throw new Error(`Transition ${this.transitionId} not found`);
    }
    this.removed ??= (timeline.transitions ?? [])[this.index];
    this.accessor.setTimeline({
      ...timeline,
      transitions: (timeline.transitions ?? []).filter((transition) => transition.id !== this.transitionId),
    });
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    const transitions = [...(timeline.transitions ?? [])];
    transitions.splice(Math.max(0, this.index), 0, this.removed);
    this.accessor.setTimeline({ ...timeline, transitions });
  }
}

export type ClipPatch = Partial<
  Omit<
    Clip,
    'type' | 'id' | 'transform' | 'colorCorrection' | 'chromaKey' | 'stabilization' | 'frameInterpolation' | 'border'
  >
> & {
  keyframes?: ClipKeyframes;
  kenBurns?: boolean;
  volume?: number;
  text?: string;
  richText?: Extract<Clip, { type: 'text' }>['richText'];
  textLayout?: Extract<Clip, { type: 'text' }>['textLayout'];
  openTypeFeatures?: Extract<Clip, { type: 'text' }>['openTypeFeatures'];
  arcText?: Extract<Clip, { type: 'text' }>['arcText'];
  colorLabel?: TimelineLabelColor | null;
  mediaId?: string;
  subtitleType?: SubtitleTrackType;
  speaker?: string;
  speakerId?: number;
  soundDesc?: string;
  subtitleMode?: SubtitleMode;
  dataSubtitle?: Extract<Clip, { type: 'subtitle' }>['dataSubtitle'];
  speed?: number;
  pitchSemitones?: number;
  audioChannelRouting?: Clip['audioChannelRouting'];
  pitchData?: Clip['pitchData'];
  muted?: boolean;
  reverseAudio?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeInCurve?: AudioFadeCurve;
  fadeOutCurve?: AudioFadeCurve;
  chromaKey?: Partial<ChromaKey>;
  stabilization?: Partial<ClipStabilization>;
  frameInterpolation?: Partial<ClipFrameInterpolation>;
  audioDenoise?: Partial<ClipAudioDenoise>;
  spatialAudio?: Partial<ClipSpatialAudio>;
  videoRestoration?: Partial<ClipVideoRestoration>;
  qualityEnhancement?: Partial<ClipQualityEnhancement>;
  projection?: ClipProjection;
  panorama?: Partial<ClipPanoramaView>;
  masks?: ClipMask[];
  motionTrack?: MotionTrackPoint[];
  border?: Partial<ClipBorder>;
  sequenceFrameRate?: number;
  colorCorrection?: Partial<ColorCorrection>;
  transform?: Partial<Transform>;
  rows?: CreditsRow[];
  rollSpeed?: number;
  style?: Partial<TextStyle> | Partial<SubtitleStyle> | Partial<CreditsStyle>;
  pathText?: Partial<TextPathOptions>;
  motionGraphic?: Partial<Extract<Clip, { type: 'motion-graphic' }>['motionGraphic']>;
};

export class UpdateClipCommand implements Command {
  readonly description = 'Update clip';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly patch: ClipPatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(timeline, [this.clipId]);
    this.before ??= findClip(timeline, this.clipId);
    const nextSpeed = typeof this.patch.speed === 'number' ? getClipSpeed({ speed: this.patch.speed }) : undefined;
    const nextColorLabel =
      this.patch.colorLabel === undefined ? this.before.colorLabel : normalizeTimelineLabelColor(this.patch.colorLabel);
    this.after = {
      ...this.before,
      ...this.patch,
      speed: nextSpeed ?? this.before.speed,
      ...(nextColorLabel === undefined ? {} : { colorLabel: nextColorLabel }),
      colorCorrection: normalizeColorCorrection({ ...this.before.colorCorrection, ...this.patch.colorCorrection }),
      chromaKey: mergeChromaKeyPatch(this.before.chromaKey, this.patch.chromaKey),
      stabilization: normalizeStabilization({ ...this.before.stabilization, ...this.patch.stabilization }),
      frameInterpolation: normalizeFrameInterpolation({
        ...this.before.frameInterpolation,
        ...this.patch.frameInterpolation,
      }),
      slowMotionMode: normalizeSlowMotionMode(this.patch.slowMotionMode ?? this.before.slowMotionMode),
      audioDenoise: normalizeAudioDenoise({ ...this.before.audioDenoise, ...this.patch.audioDenoise }),
      audioChannelRouting: normalizeAudioChannelRouting(
        this.patch.audioChannelRouting ?? this.before.audioChannelRouting,
      ),
      videoRestoration: normalizeVideoRestoration({ ...this.before.videoRestoration, ...this.patch.videoRestoration }),
      qualityEnhancement: normalizeQualityEnhancement({
        ...this.before.qualityEnhancement,
        ...this.patch.qualityEnhancement,
      }),
      projection: normalizeClipProjection(this.patch.projection ?? this.before.projection),
      panorama: normalizeClipPanoramaView({ ...this.before.panorama, ...this.patch.panorama }),
      masks: this.patch.masks === undefined ? normalizeMasks(this.before.masks) : normalizeMasks(this.patch.masks),
      motionTrack:
        this.patch.motionTrack === undefined
          ? normalizeMotionTrack(this.before.motionTrack, this.before.duration)
          : normalizeMotionTrack(this.patch.motionTrack, this.before.duration),
      border:
        this.patch.border === undefined
          ? normalizeClipBorder(this.before.border)
          : normalizeClipBorder({ ...(this.before.border ?? {}), ...this.patch.border }),
      sequenceFrameRate: normalizeSequenceFrameRate(this.patch.sequenceFrameRate ?? this.before.sequenceFrameRate),
      blendMode: normalizeClipBlendMode(this.patch.blendMode ?? this.before.blendMode),
      contentAnalysis:
        this.patch.contentAnalysis === undefined
          ? normalizeClipContentAnalysis(this.before.contentAnalysis)
          : normalizeClipContentAnalysis(this.patch.contentAnalysis),
      pitchData:
        this.patch.pitchData === undefined
          ? normalizeClipPitchData(this.before.pitchData)
          : normalizeClipPitchData(this.patch.pitchData),
      transform: normalizeTransform(
        this.patch.transform?.scale !== undefined &&
          this.patch.transform.scaleX === undefined &&
          this.patch.transform.scaleY === undefined
          ? {
              ...this.before.transform,
              ...this.patch.transform,
              scaleX: this.patch.transform.scale,
              scaleY: this.patch.transform.scale,
            }
          : { ...this.before.transform, ...this.patch.transform },
      ),
    } as Clip;
    if (this.after.type === 'video' || this.after.type === 'audio' || this.after.type === 'nested-sequence') {
      this.after = {
        ...this.after,
        pitchSemitones: normalizeAudioPitchSemitones(this.patch.pitchSemitones ?? this.after.pitchSemitones),
        reverseAudio: (this.patch.reverseAudio ?? this.after.reverseAudio) === true,
        fadeInDuration: normalizeAudioFadeDuration(
          this.patch.fadeInDuration ?? this.after.fadeInDuration,
          this.after.duration,
        ),
        fadeOutDuration: normalizeAudioFadeDuration(
          this.patch.fadeOutDuration ?? this.after.fadeOutDuration,
          this.after.duration,
        ),
        fadeInCurve: normalizeAudioFadeCurve(this.patch.fadeInCurve ?? this.after.fadeInCurve),
        fadeOutCurve: normalizeAudioFadeCurve(this.patch.fadeOutCurve ?? this.after.fadeOutCurve),
        spatialAudio: normalizeSpatialAudio({ ...this.after.spatialAudio, ...this.patch.spatialAudio }),
      } as Clip;
    }
    const speedKeyframesChanged =
      this.patch.keyframes !== undefined &&
      (Boolean(this.before.keyframes?.speed?.length) || Boolean(this.patch.keyframes?.speed?.length));
    if (typeof nextSpeed === 'number' || speedKeyframesChanged) {
      this.after = {
        ...this.after,
        duration: getClipDisplayDuration(
          getClipSourceVisibleDuration(this.before),
          nextSpeed ?? this.after.speed,
          this.after.keyframes,
        ),
      } as Clip;
      if (this.after.type === 'video' || this.after.type === 'audio' || this.after.type === 'nested-sequence') {
        this.after = {
          ...this.after,
          fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
          fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration),
        } as Clip;
      }
    }
    const beatMarkers =
      this.patch.beatMarkers === undefined
        ? normalizeClipBeatMarkers(this.after.beatMarkers, this.after.duration)
        : normalizeClipBeatMarkers(this.patch.beatMarkers, this.after.duration);
    const detectedBpm =
      this.patch.detectedBpm === undefined
        ? normalizeDetectedBpm(this.after.detectedBpm)
        : normalizeDetectedBpm(this.patch.detectedBpm);
    const scenecuts =
      this.patch.scenecuts === undefined
        ? normalizeClipSceneCuts(this.after.scenecuts, this.after.duration)
        : normalizeClipSceneCuts(this.patch.scenecuts, this.after.duration);
    this.after = {
      ...this.after,
      beatMarkers,
      detectedBpm,
      scenecuts,
    } as Clip;
    if ('style' in this.before || this.patch.style) {
      this.after = {
        ...this.after,
        style: { ...('style' in this.before ? this.before.style : {}), ...this.patch.style },
      } as Clip;
    }
    if (this.after.type === 'text') {
      this.after = {
        ...this.after,
        richText: normalizeRichTextDocument(this.after.richText, this.after.text),
        textLayout: normalizeTextLayout(this.after.textLayout),
        openTypeFeatures: normalizeTextOpenTypeFeatures(this.after.openTypeFeatures),
        arcText: normalizeTextArc(this.after.arcText),
        pathText: normalizeTextPath(this.after.pathText),
      };
    }
    if (this.after.type === 'subtitle') {
      const subtitleType = normalizeSubtitleTrackType(this.after.subtitleType);
      this.after = {
        ...this.after,
        subtitleType,
        speaker: subtitleType === 'cc' ? normalizeSubtitleSpeaker(this.after.speaker) : undefined,
        soundDesc: subtitleType === 'cc' ? normalizeSubtitleSoundDesc(this.after.soundDesc) : undefined,
        dataSubtitle: normalizeDataSubtitleSource(this.after.dataSubtitle),
      };
    }
    if (this.after.type === 'credits') {
      this.after = {
        ...this.after,
        rows: normalizeCreditsRows(
          this.patch.rows ?? (this.patch.text !== undefined ? undefined : this.after.rows),
          this.after.text,
        ),
        rollSpeed: normalizeCreditsRollSpeed(this.patch.rollSpeed ?? this.after.rollSpeed),
        style: normalizeCreditsStyle(this.after.style),
      };
    }
    if (this.after.type === 'motion-graphic') {
      this.after = {
        ...this.after,
        motionGraphic: normalizeMotionGraphic(
          this.patch.motionGraphic ?? this.after.motionGraphic,
          this.after.duration,
        ),
      };
    }
    const track = findTrack(timeline, this.after.trackId);
    if (detectOverlap(track, this.after, this.before.id)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class ApplyEffectPresetCommand implements Command {
  readonly description = 'Apply effect preset';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly preset: EffectPreset,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getTimeline();
    if (!this.after) {
      let timeline = this.before;
      const clip = findClip(timeline, this.clipId);
      const patch = buildEffectPresetClipPatch(this.preset, clip.duration);
      const commandAccessor: TimelineAccessor = {
        getTimeline: () => timeline,
        setTimeline: (nextTimeline) => {
          timeline = nextTimeline;
        },
      };
      new UpdateClipCommand(commandAccessor, this.clipId, patch).execute();
      this.after = timeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export interface BatchUpdateClipCommandItem {
  clipId: string;
  patch: ClipPatch;
}

export class BatchUpdateClipCommand implements Command {
  readonly description = 'Batch update clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly updates: BatchUpdateClipCommandItem[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(
      this.before,
      this.updates.map((u) => u.clipId),
    );
    if (!this.after) {
      let timeline = this.before;
      const batchAccessor: TimelineAccessor = {
        getTimeline: () => timeline,
        setTimeline: (nextTimeline) => {
          timeline = nextTimeline;
        },
      };
      for (const update of this.updates) {
        new UpdateClipCommand(batchAccessor, update.clipId, update.patch).execute();
      }
      this.after = timeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export interface AddEffectInput {
  id?: string;
  type: EffectType;
  enabled?: boolean;
  params?: EffectParams;
}

export class AddEffectCommand implements Command {
  readonly description = 'Add effect';
  private before?: Clip;
  private after?: Clip;
  private effect?: Effect;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly input: AddEffectInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    this.effect ??= normalizeEffect({
      id: this.input.id ?? createId('effect'),
      type: this.input.type,
      enabled: this.input.enabled ?? true,
      params: this.input.params,
    });
    if (!this.effect) {
      throw new Error('Invalid effect');
    }
    this.after = {
      ...this.before,
      effects: [...(cloneEffects(this.before.effects) ?? []), this.effect],
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class RemoveEffectCommand implements Command {
  readonly description = 'Remove effect';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly effectId: string,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const effects = cloneEffects(this.before.effects) ?? [];
    if (!effects.some((effect) => effect.id === this.effectId)) {
      throw new Error(`Effect ${this.effectId} not found`);
    }
    this.after = {
      ...this.before,
      effects: normalizeEffects(effects.filter((effect) => effect.id !== this.effectId)),
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export type EffectPatch = Partial<Pick<Effect, 'enabled' | 'params' | 'type'>>;

export class UpdateEffectCommand implements Command {
  readonly description = 'Update effect';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly effectId: string,
    private readonly patch: EffectPatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const effects = cloneEffects(this.before.effects) ?? [];
    const index = effects.findIndex((effect) => effect.id === this.effectId);
    if (index === -1) {
      throw new Error(`Effect ${this.effectId} not found`);
    }
    const existing = effects[index];
    const nextEffect = normalizeEffect({
      ...existing,
      ...this.patch,
      params: { ...existing.params, ...this.patch.params },
    });
    if (!nextEffect) {
      throw new Error('Invalid effect');
    }
    effects[index] = nextEffect;
    this.after = { ...this.before, effects } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class ReorderEffectsCommand implements Command {
  readonly description = 'Reorder effects';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly orderedEffectIds: string[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const effects = cloneEffects(this.before.effects) ?? [];
    const byId = new Map(effects.map((effect) => [effect.id, effect]));
    if (this.orderedEffectIds.some((id) => !byId.has(id))) {
      throw new Error('Effect order does not match current effect stack');
    }
    const reordered = this.orderedEffectIds.flatMap((id) => {
      const effect = byId.get(id);
      return effect ? [effect] : [];
    });
    const included = new Set(reordered.map((effect) => effect.id));
    reordered.push(...effects.filter((effect) => !included.has(effect.id)));
    if (reordered.length !== effects.length) {
      throw new Error('Effect order does not match current effect stack');
    }
    this.after = { ...this.before, effects: reordered } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class AddMaskCommand implements Command {
  readonly description = 'Add mask';
  private before?: Clip;
  private after?: Clip;
  private mask?: ClipMask;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly input: Partial<ClipMask> = {},
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    this.mask ??= createMask(this.input);
    this.after = {
      ...this.before,
      masks: [...normalizeMasks(this.before.masks), this.mask],
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class RemoveMaskCommand implements Command {
  readonly description = 'Remove mask';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly maskId: string,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const masks = normalizeMasks(this.before.masks);
    if (!masks.some((mask) => mask.id === this.maskId)) {
      throw new Error(`Mask ${this.maskId} not found`);
    }
    this.after = {
      ...this.before,
      masks: masks.filter((mask) => mask.id !== this.maskId),
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export type MaskPatch = Partial<Omit<ClipMask, 'id'>>;

export class UpdateMaskCommand implements Command {
  readonly description = 'Update mask';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly maskId: string,
    private readonly patch: MaskPatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const masks = normalizeMasks(this.before.masks);
    if (!masks.some((mask) => mask.id === this.maskId)) {
      throw new Error(`Mask ${this.maskId} not found`);
    }
    this.after = {
      ...this.before,
      masks: masks.map((mask) =>
        mask.id === this.maskId ? normalizeMask({ ...mask, ...this.patch, id: mask.id }) : mask,
      ),
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

function updateClipColorGradingGraph(
  project: Project,
  clipId: string,
  updater: (graph: ColorGradingGraph) => ColorGradingGraph,
): Project {
  const timeline = project.timeline;
  const tracks = timeline.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      const currentGraph = clip.colorGradingGraph ?? createEmptyColorGradingGraph();
      return { ...clip, colorGradingGraph: updater(currentGraph) };
    }),
  }));
  return { ...project, timeline: { ...timeline, tracks } };
}

export class AddColorNodeCommand implements Command {
  readonly description = 'Add color grading node';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly node: ColorGradingNode,
  ) {}

  execute(): void {
    if (this.after) {
      this.accessor.setProject(this.after);
      return;
    }
    this.before ??= this.accessor.getProject();
    this.after = touchProject(
      updateClipColorGradingGraph(this.before, this.clipId, (graph) => ({
        ...graph,
        nodes: [...graph.nodes, this.node],
      })),
    );
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class RemoveColorNodeCommand implements Command {
  readonly description = 'Remove color grading node';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly nodeId: string,
  ) {}

  execute(): void {
    if (this.after) {
      this.accessor.setProject(this.after);
      return;
    }
    this.before ??= this.accessor.getProject();
    this.after = touchProject(
      updateClipColorGradingGraph(this.before, this.clipId, (graph) => ({
        ...graph,
        nodes: graph.nodes.filter((n) => n.id !== this.nodeId),
        connections: graph.connections.filter((c) => c.fromNodeId !== this.nodeId && c.toNodeId !== this.nodeId),
        activeNodeId: graph.activeNodeId === this.nodeId ? null : graph.activeNodeId,
      })),
    );
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export type ColorGradingNodePatch = Partial<
  Pick<ColorGradingNode, 'enabled' | 'params' | 'position' | 'inputs' | 'output'>
>;

export class UpdateColorNodeCommand implements Command {
  readonly description = 'Update color grading node';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly nodeId: string,
    private readonly patch: ColorGradingNodePatch,
  ) {}

  execute(): void {
    if (this.after) {
      this.accessor.setProject(this.after);
      return;
    }
    this.before ??= this.accessor.getProject();
    this.after = touchProject(
      updateClipColorGradingGraph(this.before, this.clipId, (graph) => ({
        ...graph,
        nodes: graph.nodes.map((node) => {
          if (node.id !== this.nodeId) return node;
          return { ...node, ...this.patch };
        }),
      })),
    );
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class ConnectColorNodesCommand implements Command {
  readonly description: string;
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly connection: ColorGradingConnection,
    private readonly isConnect: boolean,
  ) {
    this.description = isConnect ? 'Connect color grading nodes' : 'Disconnect color grading nodes';
  }

  execute(): void {
    if (this.after) {
      this.accessor.setProject(this.after);
      return;
    }
    this.before ??= this.accessor.getProject();
    this.after = touchProject(
      updateClipColorGradingGraph(this.before, this.clipId, (graph) => {
        if (this.isConnect) {
          return { ...graph, connections: [...graph.connections, this.connection] };
        }
        return { ...graph, connections: graph.connections.filter((c) => c.id !== this.connection.id) };
      }),
    );
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}
