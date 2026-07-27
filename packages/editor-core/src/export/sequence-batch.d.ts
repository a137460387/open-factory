import { type Project, type Sequence } from '../model';
export declare class SequenceDependencyCycleError extends Error {
    readonly cycleIds: string[];
    constructor(cycleIds: string[]);
}
export declare function getSequenceDependencyIds(sequence: Sequence): string[];
export declare function sortBatchSequenceIds(project: Project, selectedSequenceIds: string[]): string[];
export declare function expandSequenceBatchOutputPath(template: string, sequence: Pick<Sequence, 'name'>, index: number, now?: Date): string;
export declare function buildProjectForSequenceExport(project: Project, sequenceId: string): Project;
export declare function getSyncedProjectSequences(project: Project): Sequence[];
//# sourceMappingURL=sequence-batch.d.ts.map