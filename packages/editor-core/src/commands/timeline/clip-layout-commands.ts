import type { TimelineAccessor, ProjectAccessor } from "./index";
import { ClipBorder, Timeline, normalizeClipBorder, normalizeTransform } from '../../model';
import type { Clip } from '../../model';
import { PiPLayoutPosition, calculatePiPTransform, createFullFrameTransform } from '../../pip-layout';
import { SplitLayoutClipSource, SplitLayoutDefinition, calculateSplitLayoutTransforms } from '../../split-layout';
import { Command } from '../command';
import { TimelineAccessor, findClip, isPiPVisualClip } from './utils';

export interface PiPLayoutCommandOptions {
  position?: PiPLayoutPosition;
  canvasWidth: number;
  canvasHeight: number;
  pipSourceWidth: number;
  pipSourceHeight: number;
  scale?: number;
  margin?: number;
  border?: Partial<ClipBorder>;
}

export class PiPLayoutCommand implements Command {
  readonly description = 'Apply PiP layout';
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly mainClipId: string,
    private readonly pipClipId: string,
    private readonly options: PiPLayoutCommandOptions,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    if (this.mainClipId === this.pipClipId) {
      throw new Error('PiP layout requires two different clips');
    }
    const mainClip = findClip(timeline, this.mainClipId);
    const pipClip = findClip(timeline, this.pipClipId);
    if (!isPiPVisualClip(mainClip) || !isPiPVisualClip(pipClip)) {
      throw new Error('PiP layout requires two visual clips');
    }
    this.before ??= timeline;
    const pipTransform = calculatePiPTransform({
      position: this.options.position ?? 'bottom-right',
      canvasWidth: this.options.canvasWidth,
      canvasHeight: this.options.canvasHeight,
      sourceWidth: this.options.pipSourceWidth,
      sourceHeight: this.options.pipSourceHeight,
      scale: this.options.scale,
      margin: this.options.margin,
    });
    const nextById = new Map<string, Clip>([
      [
        mainClip.id,
        {
          ...mainClip,
          transform: normalizeTransform(createFullFrameTransform()),
          border: normalizeClipBorder({ enabled: false }),
        } as Clip,
      ],
      [
        pipClip.id,
        {
          ...pipClip,
          transform: normalizeTransform(pipTransform),
          border: normalizeClipBorder({
            enabled: true,
            color: '#ffffff',
            width: 6,
            ...this.options.border,
          }),
        } as Clip,
      ],
    ]);
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => nextById.get(clip.id) ?? clip),
      })),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export interface ApplySplitLayoutCommandOptions {
  layout: SplitLayoutDefinition;
  canvasWidth: number;
  canvasHeight: number;
  sources?: Record<string, { width?: number; height?: number }>;
}

export class ApplySplitLayoutCommand implements Command {
  readonly description = 'Apply split-screen layout';
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly options: ApplySplitLayoutCommandOptions,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const uniqueIds = Array.from(new Set(this.clipIds));
    if (uniqueIds.length < 2 || uniqueIds.length > 4) {
      throw new Error('Split layout requires 2 to 4 clips');
    }
    const clips = uniqueIds.map((clipId) => findClip(timeline, clipId));
    if (!clips.every(isPiPVisualClip)) {
      throw new Error('Split layout requires visual clips');
    }
    this.before ??= timeline;
    const sources: SplitLayoutClipSource[] = clips.map((clip) => {
      const source = this.options.sources?.[clip.id];
      return {
        clipId: clip.id,
        sourceWidth: source?.width,
        sourceHeight: source?.height,
      };
    });
    const transforms = new Map(
      calculateSplitLayoutTransforms({
        layout: this.options.layout,
        clips: sources,
        canvasWidth: this.options.canvasWidth,
        canvasHeight: this.options.canvasHeight,
      }).map((item) => [item.clipId, item.transform]),
    );
    if (transforms.size === 0) {
      throw new Error('Split layout has no usable cells');
    }
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          const transform = transforms.get(clip.id);
          return transform ? ({ ...clip, transform: normalizeTransform(transform) } as Clip) : clip;
        }),
      })),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}
