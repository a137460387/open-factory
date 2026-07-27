import type { TimelineAccessor } from './index';
import { Clip, SubtitleStyle, Track } from '../../model';
import { SubtitleDataImportMode } from '../../subtitles/data-import';
import { SubtitleProofreadingFix } from '../../subtitles/proofreading';
import { SubtitleAlignmentOptions, SubtitleAlignmentReport, SubtitleTimingUpdate } from '../../subtitles/retiming';
import { Command } from '../command';
export declare class AddSubtitleClipCommand implements Command {
    private readonly accessor;
    private readonly clip;
    readonly description: string;
    constructor(accessor: TimelineAccessor, clip: Extract<Clip, {
        type: 'subtitle';
    }>);
    execute(): void;
    undo(): void;
}
export interface BatchImportSubtitleCommandOptions {
    mode: SubtitleDataImportMode;
    targetTrackId?: string;
}
export declare class BatchImportSubtitleCommand implements Command {
    private readonly accessor;
    private readonly track;
    private readonly options;
    readonly description = "Import subtitle clips";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, track: Track, options: BatchImportSubtitleCommandOptions);
    execute(): void;
    undo(): void;
}
export declare class BatchSubtitleTimingCommand implements Command {
    private readonly accessor;
    private readonly updates;
    readonly description = "Retiming subtitle clips";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, updates: SubtitleTimingUpdate[]);
    execute(): void;
    undo(): void;
}
export declare class BatchShiftSubtitleCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    private readonly offsetSeconds;
    private readonly projectDuration;
    readonly description = "Shift subtitle clips";
    private delegate?;
    constructor(accessor: TimelineAccessor, clipIds: string[], offsetSeconds: number, projectDuration: number);
    execute(): void;
    undo(): void;
}
export declare class BatchAlignSubtitleCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    private readonly peakTimes;
    private readonly projectDuration;
    private readonly options;
    readonly description = "Align subtitle clips to audio peaks";
    private delegate?;
    report: SubtitleAlignmentReport;
    constructor(accessor: TimelineAccessor, clipIds: string[], peakTimes: number[], projectDuration: number, options?: SubtitleAlignmentOptions);
    execute(): void;
    undo(): void;
}
export declare class BatchProofreadSubtitleCommand implements Command {
    private readonly accessor;
    private readonly fixes;
    readonly description = "Fix subtitle proofreading issues";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, fixes: SubtitleProofreadingFix[]);
    execute(): void;
    undo(): void;
}
export interface SubtitleTextUpdate {
    clipId: string;
    text: string;
}
export declare class BatchUpdateSubtitleTextCommand implements Command {
    private readonly accessor;
    private readonly updates;
    readonly description = "Update subtitle text (AI polish)";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, updates: SubtitleTextUpdate[]);
    execute(): void;
    undo(): void;
}
export declare class UpdateSubtitleStyleCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly style;
    readonly description = "Update subtitle style";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, style: Partial<SubtitleStyle>);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=subtitle-commands.d.ts.map