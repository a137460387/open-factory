import type { TimelineAccessor, ProjectAccessor } from "./index";
import { normalizeClipPitchData } from '../../audio-pitch';
import { normalizeClipBlendMode } from '../../blend-modes';
import { normalizeClipContentAnalysis } from '../../content-analysis';
import { normalizeCreditsRollSpeed, normalizeCreditsRows, normalizeCreditsStyle } from '../../credits-roll';
import { normalizeDataSubtitleSource } from '../../data-subtitle';
import { Timeline, normalizeAudioChannelRouting, normalizeAudioDenoise, normalizeAudioFadeCurve, normalizeAudioFadeDuration, normalizeAudioPitchSemitones, normalizeClipBeatMarkers, normalizeClipBorder, normalizeClipPanoramaView, normalizeClipProjection, normalizeClipSceneCuts, normalizeColorCorrection, normalizeDetectedBpm, normalizeFrameInterpolation, normalizeMasks, normalizeMotionTrack, normalizeQualityEnhancement, normalizeSequenceFrameRate, normalizeSlowMotionMode, normalizeStabilization, normalizeSubtitleSoundDesc, normalizeSubtitleSpeaker, normalizeSubtitleTrackType, normalizeTextPath, normalizeTransform, normalizeVideoRestoration } from '../../model';
import type { Clip } from '../../model';
import { normalizeMotionGraphic } from '../../motion-graphics';
import { normalizeSpatialAudio } from '../../spatial-audio';
import { normalizeRichTextDocument, normalizeTextArc, normalizeTextLayout, normalizeTextOpenTypeFeatures } from '../../text-layout';
import { detectOverlap, getClipDisplayDuration, getClipSourceVisibleDuration, getClipSpeed, replaceClip } from '../../timeline';
import { normalizeTimelineLabelColor } from '../../timeline-color-labels';
import { Command } from '../command';
import { ClipPatch } from './clip-edit-commands';
import { TimelineAccessor, assertClipsNotOnLockedTrack, findClip, findTrack, mergeChromaKeyPatch } from './utils';

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
