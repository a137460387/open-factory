import type { TimelineAccessor, ProjectAccessor } from "./index";
import { Timeline } from '../../model';
import type { Clip } from '../../model';
import { filterShortSceneCuts } from '../../scene-cuts';
import { SmartDialogueInterval, SmartMontageConfig, SmartRoughCutVisualClip, buildDialogueRoughCutClips, buildRhythmAssembleClips, buildSmartMontageClips } from '../../smart-rough-cut-v2';
import { replaceClip } from '../../timeline';
import { Command } from '../command';
import { LocalTimeRange, TimelineAccessor, buildKeptRanges, buildSplitRanges, findClip, insertGeneratedClips, removeClipsFromTimeline, replaceClipWithGeneratedClips, replaceClipWithSlices } from './utils';

export interface BatchSplitAtSceneCutItem {
  clipId: string;
  cuts?: number[];
  minSceneSeconds?: number;
}

export class BatchSplitAtSceneCutsCommand implements Command {
  readonly description = 'Split clips at scene cuts';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly items: BatchSplitAtSceneCutItem[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      let next = timeline;
      let splitCount = 0;
      for (const item of this.items) {
        const clip = findClip(next, item.clipId);
        const cuts = item.cuts ?? clip.scenecuts ?? [];
        const splitTimes = filterShortSceneCuts(cuts, clip.duration, item.minSceneSeconds ?? 0);
        if (splitTimes.length === 0) {
          continue;
        }
        const ranges = buildSplitRanges(clip.duration, splitTimes);
        if (ranges.length <= 1) {
          continue;
        }
        next = replaceClip(next, { ...clip, scenecuts: splitTimes } as Clip);
        next = replaceClipWithSlices(next, item.clipId, ranges, false);
        splitCount += splitTimes.length;
      }
      if (splitCount === 0) {
        throw new Error('No valid scene cuts inside clip bounds');
      }
      this.after = next;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    this.accessor.setTimeline(this.before);
  }
}

export class RemoveSilenceCommand implements Command {
  readonly description = 'Remove silence';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly ranges: LocalTimeRange[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const clip = findClip(timeline, this.clipId);
      const keptRanges = buildKeptRanges(clip.duration, this.ranges);
      if (keptRanges.length === 0) {
        throw new Error('Silence removal would remove the entire clip');
      }
      if (keptRanges.length === 1 && keptRanges[0].start <= 0.000001 && keptRanges[0].end >= clip.duration - 0.000001) {
        throw new Error('No silence ranges inside clip bounds');
      }
      this.after = replaceClipWithSlices(timeline, this.clipId, keptRanges, true);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    this.accessor.setTimeline(this.before);
  }
}

export class DialogueRoughCutCommand implements Command {
  readonly description = 'Dialogue rough cut';
  private before?: Timeline;
  private after?: Timeline;
  private generatedCount = 0;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly intervals: SmartDialogueInterval[],
  ) {}

  get clipCount(): number {
    return this.generatedCount;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const clip = findClip(timeline, this.clipId);
      if (clip.type !== 'audio' && clip.type !== 'video') {
        throw new Error('Dialogue rough cut requires an audio or video clip');
      }
      const clips = buildDialogueRoughCutClips(clip, this.intervals);
      if (clips.length === 0) {
        throw new Error('No dialogue intervals inside clip bounds');
      }
      this.generatedCount = clips.length;
      this.after = replaceClipWithGeneratedClips(timeline, clip.id, clips);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class BrollInsertCommand implements Command {
  readonly description = 'Insert B-roll clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clips: SmartRoughCutVisualClip[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      if (this.clips.length === 0) {
        throw new Error('No B-roll clips to insert');
      }
      this.after = insertGeneratedClips(timeline, this.clips);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class RhythmAssembleCommand implements Command {
  readonly description = 'Rhythm assemble clips';
  private before?: Timeline;
  private after?: Timeline;
  private generatedCount = 0;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly beatTimes: number[],
    private readonly targetTrackId?: string,
  ) {}

  get clipCount(): number {
    return this.generatedCount;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const selected = new Set(this.clipIds);
      const clips = timeline.tracks
        .flatMap((track) => track.clips)
        .filter(
          (clip): clip is SmartRoughCutVisualClip =>
            selected.has(clip.id) && (clip.type === 'video' || clip.type === 'image'),
        );
      const assembled = buildRhythmAssembleClips(clips, this.beatTimes, this.targetTrackId);
      if (assembled.length === 0) {
        throw new Error('No rhythm clips to assemble');
      }
      this.generatedCount = assembled.length;
      const withoutSources = removeClipsFromTimeline(timeline, new Set(clips.map((clip) => clip.id)));
      this.after = insertGeneratedClips(withoutSources, assembled);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class SmartMontageCommand implements Command {
  readonly description = 'AI smart montage';
  private before?: Timeline;
  private after?: Timeline;
  private result: { clipCount: number; estimatedBpm: number } = { clipCount: 0, estimatedBpm: 0 };

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly config: SmartMontageConfig,
  ) {}

  get montageResult(): { clipCount: number; estimatedBpm: number } {
    return this.result;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const montage = buildSmartMontageClips(this.config);
      if (!montage) {
        throw new Error('Smart montage: unable to build clips from the provided assets and beat data');
      }
      const allClips: Clip[] = [...montage.visualClips, montage.audioClip];
      this.result = { clipCount: montage.visualClips.length, estimatedBpm: montage.estimatedBpm };
      this.after = insertGeneratedClips(timeline, allClips);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}
