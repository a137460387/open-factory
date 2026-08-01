import type {Clip, Project} from '@open-factory/editor-core';
import type {PreviewPerformanceSettings, PreviewSkipFrames} from '../lib/preview/preview-performance';
import type {ClipMacro} from '../macros/clip-macros';
import type {TimelineShortcutBindings} from '../shortcuts/timeline-shortcuts';
import type {TimelineInteractionSettings} from './appSettings';

export interface SettingsDialogProps {
  open: boolean;
  project: Project;
  selectedClip?: Clip;
  shortcutBindings: TimelineShortcutBindings;
  macros: ClipMacro[];
  previewPerformance: PreviewPerformanceSettings;
  timelineInteractionSettings: TimelineInteractionSettings;
  onShortcutBindingsChange(bindings: TimelineShortcutBindings): void;
  onMacrosChange(macros: ClipMacro[]): void;
  onExecuteMacro(macro: ClipMacro): void;
  onPreviewPerformanceChange(settings: Partial<PreviewPerformanceSettings>): void;
  onPreviewSkipFramesChange(skipFrames: PreviewSkipFrames): void;
  onTimelineInteractionSettingsChange(settings: Partial<TimelineInteractionSettings>): void;
  onDeleteProxies(assetIds: string[]): Promise<void> | void;
  onRegenerateProxies(assetIds: string[]): Promise<void> | void;
  onMigrateProxies(targetDirectory: string): Promise<void> | void;
  onClose(): void;
}

export type SettingsTab =
  | 'general'
  | 'display'
  | 'appearance'
  | 'lut-library'
  | 'effect-presets'
  | 'shortcuts'
  | 'macros'
  | 'automation'
  | 'scripts'
  | 'translation'
  | 'local-models'
  | 'proxy'
  | 'task-monitor'
  | 'export-presets'
  | 'backup'
  | 'plugins'
  | 'ai-services'
  | 'hardware-acceleration'
  | 'gesture';
