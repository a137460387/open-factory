import type { MixerState, MixerChannel, AudioBus } from '../audio/mixer-types';
import type { ClipAIReframe } from '../ai-reframe';
import type { AnomalyInterval } from '../anomaly-detection';
import type { FlashWarning } from '../flash-warning';
import type { ReadingSpeedWarning } from '../subtitle-reading-speed';
import type { MusicStructurePoint } from '../music-structure';
import type { ContinuityWarning } from '../continuity-check';
import type { AiPipPlacementSuggestion, ClipAILookMatch, ClipKeyframes, ClipPrivacyRedaction, CollaborationNoteType, LUTLayer, MediaAsset, Project, ProjectPlatformFitSuggestion, ProjectSettings, ReviewAnnotationType, Timeline } from '../model-types';
export declare function serializeLegacyProject(project: Project): {
    version: '0.1';
    project: {
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
        settings: ProjectSettings;
    };
    assets: MediaAsset[];
    timeline: Timeline;
};
export declare function normalizeTimelineMarkerTime(time: number, maxTime?: number): number;
export declare function normalizeTimelinePointTime(time: number, maxTime?: number): number;
export declare function normalizeTimelineMarkerLabel(label: string | undefined): string;
export declare function normalizeTimelineBookmarkNote(note: string | undefined): string;
export declare function normalizeBookmarkAnnotation(annotation: string | undefined): string | undefined;
export declare function normalizeTimelineMarkerColor(color: string | undefined): string;
export declare function normalizeProjectAnnotationText(text: string | undefined): string;
export declare function normalizeReviewAnnotationText(text: string | undefined): string;
export declare function normalizeCollaborationNoteText(text: string | undefined): string;
export declare function normalizeCollaborationAuthorName(name: string | undefined): string;
export declare function normalizeTimelineNoteText(text: string | undefined): string;
export declare function normalizeCollaborationNoteType(type: CollaborationNoteType | undefined): CollaborationNoteType;
export declare function normalizeReviewAnnotationType(type: ReviewAnnotationType | undefined): ReviewAnnotationType;
export declare function normalizeReviewAnnotationUnit(value: number | undefined, fallback: number): number;
export declare function normalizeReviewAnnotationDimension(value: number | undefined, type: ReviewAnnotationType, axis: 'width' | 'height'): number;
export declare function normalizeTimelineNoteColor(color: string | undefined): string;
export declare function normalizeIsoDate(value: string | undefined): string;
export declare function normalizeExportRangeLabel(label: string | undefined): string;
export declare function normalizeProtectedRangeLabel(label: string | undefined): string;
export declare function normalizeHexColor(color: string | undefined, fallback: string): string;
export { normalizeOptionalHexColor } from '../math-utils';
export declare function normalizeLutPath(path: string | null | undefined): string | null;
export declare function normalizeLutLayers(luts: LUTLayer[] | undefined, lutPath?: string | null): LUTLayer[];
export declare function normalizeClipAIReframe(value: unknown): ClipAIReframe | undefined;
export declare function normalizeAnomalyIntervals(value: unknown): AnomalyInterval[];
export declare function normalizeSubtitleSpeakerId(value: unknown): number | undefined;
export declare function normalizeSpeakerLabels(value: unknown): Record<number, string> | undefined;
export declare function cloneClipKeyframesLocal(keyframes: ClipKeyframes | undefined): ClipKeyframes | undefined;
export declare function normalizePrivacyRedactions(input: unknown): ClipPrivacyRedaction[];
export declare function normalizeAILookMatch(input: unknown): ClipAILookMatch | undefined;
export declare function normalizeAiPipSuggestion(input: unknown): AiPipPlacementSuggestion | undefined;
export declare function normalizePlatformFitSuggestion(input: unknown): ProjectPlatformFitSuggestion | undefined;
/** Normalize flash warnings array */
export declare function normalizeFlashWarnings(input: unknown): FlashWarning[];
/** Normalize reading speed warning */
export declare function normalizeReadingSpeedWarning(input: unknown): ReadingSpeedWarning | null;
/** Normalize music structure points */
export declare function normalizeMusicStructurePoints(input: unknown): MusicStructurePoint[];
/** Normalize continuity warnings */
export declare function normalizeContinuityWarnings(input: unknown): ContinuityWarning[];
/** Normalize mixer bus */
export declare function normalizeBus(raw: any): AudioBus;
/** Normalize mixer channel */
export declare function normalizeMixerChannel(raw: any): MixerChannel;
/** Normalize mixer state */
export declare function normalizeMixerState(raw: any): MixerState | undefined;
//# sourceMappingURL=annotations.d.ts.map