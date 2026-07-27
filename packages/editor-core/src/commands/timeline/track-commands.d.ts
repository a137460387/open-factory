import type { TimelineAccessor } from './index';
import { Track } from '../../model';
import { Command } from '../command';
export declare class AddTrackCommand implements Command {
    private readonly accessor;
    private readonly track;
    readonly description: string;
    private index;
    constructor(accessor: TimelineAccessor, track: Track);
    execute(): void;
    undo(): void;
}
export declare class AddSpeakerDiarizationTracksCommand implements Command {
    private readonly accessor;
    private readonly tracks;
    readonly description = "Add speaker diarization tracks";
    private before?;
    constructor(accessor: TimelineAccessor, tracks: Track[]);
    execute(): void;
    undo(): void;
}
export type TrackPatch = Partial<Pick<Track, 'name' | 'language' | 'subtitleType' | 'color' | 'muted' | 'solo' | 'locked' | 'volume' | 'pan' | 'eq' | 'compressor'>>;
export interface BatchUpdateTrackCommandOptions {
    patches?: Record<string, TrackPatch>;
    order?: string[];
    deleteEmptyTrackIds?: string[];
}
export declare class UpdateTrackCommand implements Command {
    private readonly accessor;
    private readonly trackId;
    private readonly patch;
    readonly description = "Update track";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, trackId: string, patch: TrackPatch);
    execute(): void;
    undo(): void;
}
export declare class BatchUpdateTrackCommand implements Command {
    private readonly accessor;
    private readonly options;
    readonly description = "Batch update tracks";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, options: BatchUpdateTrackCommandOptions);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=track-commands.d.ts.map