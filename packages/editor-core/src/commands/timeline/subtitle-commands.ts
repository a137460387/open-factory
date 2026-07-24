import type { TimelineAccessor, ProjectAccessor } from "./index";
import { Clip, DEFAULT_SUBTITLE_STYLE, SubtitleStyle, Timeline, Track, createTrack } from '../../model';
import { SubtitleDataImportMode } from '../../subtitles/data-import';
import { SubtitleProofreadingFix } from '../../subtitles/proofreading';
import { SubtitleAlignmentOptions, SubtitleAlignmentReport, SubtitleTimingUpdate, calculateSubtitleAlignmentUpdates, calculateSubtitleShiftUpdates } from '../../subtitles/retiming';
import { normalizeSubtitleStyleTemplateStyle } from '../../subtitles/style-templates';
import { round } from '../../time';
import { detectOverlap, removeClip, replaceClip } from '../../timeline';
import { Command } from '../command';
import { TimelineAccessor, cloneCommandValue, findClip, findTrack, insertClip, timelineHasOverlaps } from './utils';

export class AddSubtitleClipCommand implements Command {
  readonly description: string;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clip: Extract<Clip, { type: 'subtitle' }>,
  ) {
    this.description = `Add subtitle clip ${clip.name}`;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const track = findTrack(timeline, this.clip.trackId);
    if (track.type !== 'subtitle') {
      throw new Error('Subtitle clips can only be added to subtitle tracks');
    }
    if (detectOverlap(track, this.clip)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(insertClip(timeline, this.clip));
  }

  undo(): void {
    this.accessor.setTimeline(removeClip(this.accessor.getTimeline(), this.clip.id).timeline);
  }
}

function resolveSubtitleImportTarget(timeline: Timeline, targetTrackId: string | undefined): Track | undefined {
  const track = targetTrackId
    ? timeline.tracks.find((item) => item.id === targetTrackId)
    : timeline.tracks.find((item) => item.type === 'subtitle');
  if (track && track.type !== 'subtitle') {
    throw new Error('Subtitle import target must be a subtitle track');
  }
  return track;
}

export interface BatchImportSubtitleCommandOptions {
  mode: SubtitleDataImportMode;
  targetTrackId?: string;
}

export class BatchImportSubtitleCommand implements Command {
  readonly description = 'Import subtitle clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly track: Track,
    private readonly options: BatchImportSubtitleCommandOptions,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      if (this.track.type !== 'subtitle') {
        throw new Error('Batch subtitle import requires a subtitle track');
      }
      const clips = this.track.clips.map((clip) => {
        if (clip.type !== 'subtitle') {
          throw new Error('Batch subtitle import can only contain subtitle clips');
        }
        return clip;
      });
      if (clips.length === 0) {
        throw new Error('No subtitle clips to import');
      }
      const targetTrack = resolveSubtitleImportTarget(timeline, this.options.targetTrackId);
      const shouldUseExistingTrack = this.options.mode !== 'new-track' && targetTrack;
      const targetTrackId = shouldUseExistingTrack ? targetTrack.id : this.track.id;
      const importedClips = clips.map((clip) => ({ ...clip, trackId: targetTrackId }));
      if (!shouldUseExistingTrack) {
        this.after = {
          ...timeline,
          tracks: [...timeline.tracks, createTrack({ ...this.track, clips: importedClips })],
        };
      } else if (this.options.mode === 'replace-current-track') {
        this.after = {
          ...timeline,
          tracks: timeline.tracks.map((track) =>
            track.id === targetTrack.id
              ? createTrack({ ...track, name: this.track.name, clips: importedClips })
              : track,
          ),
        };
      } else {
        this.after = {
          ...timeline,
          tracks: timeline.tracks.map((track) =>
            track.id === targetTrack.id ? createTrack({ ...track, clips: [...track.clips, ...importedClips] }) : track,
          ),
        };
      }
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class BatchSubtitleTimingCommand implements Command {
  readonly description = 'Retiming subtitle clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly updates: SubtitleTimingUpdate[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const updatesByClipId = new Map(this.updates.map((update) => [update.clipId, update]));
      if (updatesByClipId.size === 0) {
        throw new Error('No subtitle timing updates');
      }
      let changed = 0;
      const nextTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            const update = updatesByClipId.get(clip.id);
            if (!update) {
              return clip;
            }
            if (clip.type !== 'subtitle') {
              throw new Error('Subtitle timing updates can only target subtitle clips');
            }
            changed += 1;
            return {
              ...clip,
              start: round(Math.max(0, update.start)),
              duration: round(Math.max(1 / 30, update.duration)),
            };
          }),
        })),
      };
      if (changed === 0) {
        throw new Error('No subtitle clips found for retiming');
      }
      if (timelineHasOverlaps(nextTimeline)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      this.after = nextTimeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class BatchShiftSubtitleCommand implements Command {
  readonly description = 'Shift subtitle clips';
  private delegate?: BatchSubtitleTimingCommand;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly offsetSeconds: number,
    private readonly projectDuration: number,
  ) {}

  execute(): void {
    if (!this.delegate) {
      const timeline = this.accessor.getTimeline();
      const ids = new Set(this.clipIds);
      const clips = timeline.tracks
        .flatMap((track) => track.clips)
        .filter((clip): clip is Extract<Clip, { type: 'subtitle' }> => clip.type === 'subtitle' && ids.has(clip.id));
      this.delegate = new BatchSubtitleTimingCommand(
        this.accessor,
        calculateSubtitleShiftUpdates(clips, this.offsetSeconds, this.projectDuration),
      );
    }
    this.delegate.execute();
  }

  undo(): void {
    this.delegate?.undo();
  }
}

export class BatchAlignSubtitleCommand implements Command {
  readonly description = 'Align subtitle clips to audio peaks';
  private delegate?: BatchSubtitleTimingCommand;
  report: SubtitleAlignmentReport = { correctedCount: 0, averageOffsetMs: 0, updates: [] };

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly peakTimes: number[],
    private readonly projectDuration: number,
    private readonly options: SubtitleAlignmentOptions = {},
  ) {}

  execute(): void {
    if (!this.delegate) {
      const timeline = this.accessor.getTimeline();
      const ids = new Set(this.clipIds);
      const clips = timeline.tracks
        .flatMap((track) => track.clips)
        .filter((clip): clip is Extract<Clip, { type: 'subtitle' }> => clip.type === 'subtitle' && ids.has(clip.id));
      this.report = calculateSubtitleAlignmentUpdates(clips, this.peakTimes, this.projectDuration, this.options);
      if (this.report.updates.length === 0) {
        throw new Error('No subtitle alignment updates');
      }
      this.delegate = new BatchSubtitleTimingCommand(this.accessor, this.report.updates);
    }
    this.delegate.execute();
  }

  undo(): void {
    this.delegate?.undo();
  }
}

export class BatchProofreadSubtitleCommand implements Command {
  readonly description = 'Fix subtitle proofreading issues';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly fixes: SubtitleProofreadingFix[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const fixesByClipId = new Map(this.fixes.map((fix) => [fix.clipId, fix]));
      if (fixesByClipId.size === 0) {
        throw new Error('No subtitle proofreading fixes');
      }
      let changed = 0;
      const nextTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.flatMap((clip) => {
            const fix = fixesByClipId.get(clip.id);
            if (!fix) {
              return [clip];
            }
            if (clip.type !== 'subtitle') {
              throw new Error('Subtitle proofreading fixes can only target subtitle clips');
            }
            if (fix.delete) {
              changed += 1;
              return [];
            }
            const nextDuration = round(Math.max(1 / 30, fix.duration ?? clip.duration));
            if (Math.abs(nextDuration - clip.duration) <= 0.000001) {
              return [clip];
            }
            changed += 1;
            return [{ ...clip, duration: nextDuration }];
          }),
        })),
      };
      if (changed === 0) {
        throw new Error('No subtitle clips found for proofreading fixes');
      }
      if (timelineHasOverlaps(nextTimeline)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      this.after = nextTimeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export interface SubtitleTextUpdate {
  clipId: string;
  text: string;
}

export class BatchUpdateSubtitleTextCommand implements Command {
  readonly description = 'Update subtitle text (AI polish)';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly updates: SubtitleTextUpdate[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const updatesByClipId = new Map(this.updates.map((u) => [u.clipId, u]));
      if (updatesByClipId.size === 0) {
        throw new Error('No subtitle text updates');
      }
      let changed = 0;
      const nextTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            const update = updatesByClipId.get(clip.id);
            if (!update || clip.type !== 'subtitle') {
              return clip;
            }
            if (clip.text === update.text) {
              return clip;
            }
            changed += 1;
            return { ...clip, text: update.text };
          }),
        })),
      };
      if (changed === 0) {
        throw new Error('No subtitle clips found for text updates');
      }
      this.after = nextTimeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class UpdateSubtitleStyleCommand implements Command {
  readonly description = 'Update subtitle style';
  private before?: Extract<Clip, { type: 'subtitle' }>;
  private after?: Extract<Clip, { type: 'subtitle' }>;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly style: Partial<SubtitleStyle>,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const clip = findClip(timeline, this.clipId);
    if (clip.type !== 'subtitle') {
      throw new Error(`Clip ${this.clipId} is not a subtitle clip`);
    }
    this.before ??= cloneCommandValue(clip);
    const nextStyle = normalizeSubtitleStyleTemplateStyle({ ...DEFAULT_SUBTITLE_STYLE, ...clip.style, ...this.style });
    this.after = {
      ...clip,
      style: nextStyle,
    };
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}
