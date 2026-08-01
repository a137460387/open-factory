// Barrel re-export: all dialog components and state interfaces
// are defined in individual files within this directory.
// This file preserves the original public API so consumers need no changes.

export type { AnnotationEditorState } from './AnnotationEditorDialog';
export { AnnotationEditorDialog } from './AnnotationEditorDialog';

export type { TimelineNoteEditorState } from './TimelineNoteEditorDialog';
export { TimelineNoteEditorDialog } from './TimelineNoteEditorDialog';

export type { ReplaceMediaDialogState } from './ReplaceMediaDialog';
export { ReplaceMediaDialog } from './ReplaceMediaDialog';

export type { SilenceDialogState } from './SilenceDetectionDialog';
export { SilenceDetectionDialog } from './SilenceDetectionDialog';

export type { SceneDialogState } from './SceneDetectionDialog';
export { SceneDetectionDialog } from './SceneDetectionDialog';

export type { CoverFrameDialogState } from './CoverFramePickerDialog';
export { CoverFramePickerDialog } from './CoverFramePickerDialog';

export type { WhisperDialogState } from './WhisperGenerationDialog';
export { WhisperGenerationDialog } from './WhisperGenerationDialog';

export { DialogueDetectionPanel } from './DialogueDetectionPanel';

export { SequenceSettingsDialog } from './SequenceSettingsDialog';

export { GapStatsPanel } from './GapStatsPanel';
