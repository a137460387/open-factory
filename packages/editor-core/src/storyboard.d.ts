import type { Clip, Timeline, Track } from './model';
export type StoryboardClip = Extract<Clip, {
    type: 'video' | 'image';
}>;
export interface StoryboardCard {
    clip: StoryboardClip;
    track: Track;
    trackIndex: number;
}
export declare function isStoryboardClip(clip: Clip): clip is StoryboardClip;
export declare function getStoryboardCards(timeline: Timeline): StoryboardCard[];
export declare function reorderStoryboardClipIds(currentIds: string[], draggedClipId: string, targetClipId: string): string[];
export declare function buildStoryboardReorderStarts(timeline: Timeline, orderedClipIds: string[]): Record<string, number>;
//# sourceMappingURL=storyboard.d.ts.map