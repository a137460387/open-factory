import type { TimelineAccessor } from './index';
import { SmartDialogueInterval, SmartMontageConfig, SmartRoughCutVisualClip } from '../../smart-rough-cut-v2';
import { Command } from '../command';
import { LocalTimeRange } from './utils';
export interface BatchSplitAtSceneCutItem {
    clipId: string;
    cuts?: number[];
    minSceneSeconds?: number;
}
export declare class BatchSplitAtSceneCutsCommand implements Command {
    private readonly accessor;
    private readonly items;
    readonly description = "Split clips at scene cuts";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, items: BatchSplitAtSceneCutItem[]);
    execute(): void;
    undo(): void;
}
export declare class RemoveSilenceCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly ranges;
    readonly description = "Remove silence";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, ranges: LocalTimeRange[]);
    execute(): void;
    undo(): void;
}
export declare class DialogueRoughCutCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly intervals;
    readonly description = "Dialogue rough cut";
    private before?;
    private after?;
    private generatedCount;
    constructor(accessor: TimelineAccessor, clipId: string, intervals: SmartDialogueInterval[]);
    get clipCount(): number;
    execute(): void;
    undo(): void;
}
export declare class BrollInsertCommand implements Command {
    private readonly accessor;
    private readonly clips;
    readonly description = "Insert B-roll clips";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clips: SmartRoughCutVisualClip[]);
    execute(): void;
    undo(): void;
}
export declare class RhythmAssembleCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    private readonly beatTimes;
    private readonly targetTrackId?;
    readonly description = "Rhythm assemble clips";
    private before?;
    private after?;
    private generatedCount;
    constructor(accessor: TimelineAccessor, clipIds: string[], beatTimes: number[], targetTrackId?: string | undefined);
    get clipCount(): number;
    execute(): void;
    undo(): void;
}
export declare class SmartMontageCommand implements Command {
    private readonly accessor;
    private readonly config;
    readonly description = "AI smart montage";
    private before?;
    private after?;
    private result;
    constructor(accessor: TimelineAccessor, config: SmartMontageConfig);
    get montageResult(): {
        clipCount: number;
        estimatedBpm: number;
    };
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=clip-smart-commands.d.ts.map