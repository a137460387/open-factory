import { ColorGradingGraph } from '../../color-grading/types';
import { CollaborationNote, Project, ProjectAnnotation, ReviewAnnotation, Timeline, TimelineBookmark, TimelineMarker, TimelineNote } from '../../model';
import type { Clip } from '../../model';
export declare function buildRollingTrimClips(left: Clip, right: Clip, requestedDelta: number, minDuration: number): {
    left: Clip;
    right: Clip;
};
export interface SlideClipEditResult {
    timeline: Timeline;
    leftClip: Clip;
    clip: Clip;
    rightClip: Clip;
    delta: number;
}
export declare function buildSlideClipEdit(timeline: Timeline, clipId: string, requestedDelta: number, minDuration?: number): SlideClipEditResult;
export declare function packNestedSequence(project: Project, clipIds: string[], sequenceName: string): Project;
export declare function cutMulticamClip(project: Project, clipId: string, sceneTime: number, angleId: string): Project;
export declare function trimMulticamClip(project: Project, clipId: string, switchId: string, frameDelta: number, fps: number): Project;
export declare function cloneClipForNestedSequence<TClip extends Clip>(clip: TClip): TClip;
export declare function sortMarkers(markers: TimelineMarker[]): TimelineMarker[];
export declare function sortAnnotations(annotations: ProjectAnnotation[]): ProjectAnnotation[];
export declare function sortReviewAnnotations(annotations: ReviewAnnotation[]): ReviewAnnotation[];
export declare function sortCollaborationNotes(notes: CollaborationNote[]): CollaborationNote[];
export declare function sortTimelineNotes(notes: TimelineNote[]): TimelineNote[];
export declare function sortBookmarks(bookmarks: TimelineBookmark[]): TimelineBookmark[];
/** 子剪辑操作命令 */
export declare function updateClipColorGradingGraph(project: Project, clipId: string, updater: (graph: ColorGradingGraph) => ColorGradingGraph): Project;
/** 添加调色节点 */
//# sourceMappingURL=utils-nested.d.ts.map