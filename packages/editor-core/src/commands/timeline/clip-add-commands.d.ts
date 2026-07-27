import type { TimelineAccessor } from './index';
import { Clip, Track } from '../../model';
import { Command } from '../command';
export declare class AddClipCommand implements Command {
    private readonly accessor;
    private readonly clip;
    readonly description: string;
    constructor(accessor: TimelineAccessor, clip: Clip);
    execute(): void;
    undo(): void;
}
export declare class AddAdjustmentLayerCommand implements Command {
    private readonly accessor;
    private readonly track;
    private readonly clip;
    readonly description: string;
    private insertedTrack;
    constructor(accessor: TimelineAccessor, track: Track, clip: Extract<Clip, {
        type: 'adjustment';
    }>);
    execute(): void;
    undo(): void;
}
export declare class AddMotionGraphicCommand implements Command {
    private readonly accessor;
    private readonly track;
    private readonly clip;
    readonly description: string;
    private insertedTrack;
    constructor(accessor: TimelineAccessor, track: Track, clip: Extract<Clip, {
        type: 'motion-graphic';
    }>);
    execute(): void;
    undo(): void;
}
export declare class AddCreditsClipCommand implements Command {
    private readonly accessor;
    private readonly clip;
    readonly description: string;
    constructor(accessor: TimelineAccessor, clip: Extract<Clip, {
        type: 'credits';
    }>);
    execute(): void;
    undo(): void;
}
export declare class BatchAddClipsCommand implements Command {
    private readonly accessor;
    private readonly clips;
    private readonly newTracks;
    readonly description = "Batch add clips (AI rough cut)";
    private before?;
    private after?;
    private insertedTrackIds;
    constructor(accessor: TimelineAccessor, clips: Clip[], newTracks: Array<{
        id: string;
        name: string;
        type: 'video' | 'audio';
    }>);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=clip-add-commands.d.ts.map