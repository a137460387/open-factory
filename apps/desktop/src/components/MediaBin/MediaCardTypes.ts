import type {Subclip} from '@open-factory/editor-core';
import type {MediaAsset, MediaFlag, MediaLabelColor, QualityAssessmentResult} from '@open-factory/editor-core';
import {createContext, type CSSProperties} from 'react';

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

export interface MediaCardExtras {
  favoriteIds: Set<string>;
  onToggleFavorite(assetId: string): void;
  onRevealInTimeline(assetId: string): void;
  pinnedIds: Set<string>;
  onPinToSession(assetId: string): void;
  onAnalyzeAI(assetId: string): void;
  qualityResults: Map<string, QualityAssessmentResult>;
  qualityErrors: Map<string, string>;
  qualityLoading: Set<string>;
  onQualityAssess(assetId: string): void;
  onBatchQualityScan(): void;
}
export const MediaCardExtrasCtx = createContext<MediaCardExtras | null>(null);

export interface MediaGridNavCtxValue {
  columnCount: number;
  mediaCount: number;
  scrollToMediaIndex(index: number): void;
  pendingFocusRef: { current: number | null };
}
export const MediaGridNavCtx = createContext<MediaGridNavCtxValue | null>(null);

export interface SubclipContextValue {
  subclips: Subclip[];
  onAddSubclip(subclip: Subclip): void;
  onUpdateSubclip(subclipId: string, patch: Partial<Subclip>): void;
  onDeleteSubclip(subclipId: string): void;
  onAddSubclipToTimeline(assetId: string, subclip: Subclip): void;
  onOpenSubclipDialog(assetId: string, editingSubclipId?: string): void;
  expandedSubclipAssetIds: Set<string>;
  onToggleSubclipExpanded(assetId: string): void;
}
export const SubclipCtx = createContext<SubclipContextValue | null>(null);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MEDIA_CARD_DRAG_MIME = 'application/x-open-factory-media-id';
export const SUBCLIP_DRAG_MIME = 'application/x-open-factory-subclip';

export const MEDIA_LABEL_COLORS: Array<{ key: MediaLabelColor; value: string }> = [
  { key: 'red', value: '#ef4444' },
  { key: 'orange', value: '#f97316' },
  { key: 'yellow', value: '#eab308' },
  { key: 'green', value: '#22c55e' },
  { key: 'blue', value: '#3b82f6' },
  { key: 'purple', value: '#a855f7' },
];
export const MEDIA_LABEL_COLOR_STYLES: Record<string, CSSProperties> = Object.fromEntries(
  MEDIA_LABEL_COLORS.map((c) => [c.key, { backgroundColor: c.value }]),
);

// ---------------------------------------------------------------------------
// Menu actions bundle
// ---------------------------------------------------------------------------

export interface MediaCardMenuActions {
  onShowInfo(): void;
  onAddVersion(): void;
  onFindSources(): void;
  onCompareVersions(): void;
  onBatchTranscode(): void;
  onExportGif(): void;
  onAnalyzeSpectrum(): void;
  onSetLabel(labelColor?: MediaLabelColor): void;
  onSetRating(rating: number): void;
  onSetFlag(flag?: MediaFlag): void;
  onOpenBatchMetadata(): void;
  onOpenBatchRename(): void;
  onAdd(): void;
  onRelink(): void;
  onGenerateProxy(): void;
  onConvertToCfr(): void;
  onToggleSelected(): void;
}
