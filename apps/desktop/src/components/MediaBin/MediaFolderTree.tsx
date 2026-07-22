import {
  MAX_MEDIA_FOLDER_DEPTH,
  getMediaFolderDepth,
  type MediaAsset,
  type ClipContentAnalysis,
  type MediaFlag,
  type MediaFolder,
  type MediaLabelColor,
  type MediaMetadata,
} from '@open-factory/editor-core';
import { ChevronDown, ChevronRight, Folder, FolderPlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { zhCN } from '../../i18n/strings';
import type { MediaLibraryGridSize } from '../../media/mediaLibraryView';
import { MEDIA_CARD_DRAG_MIME } from './media-bin-utils';
import { MediaCardGrid } from './MediaBin';

export function MediaFolderTree(props: {
  folders: MediaFolder[];
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  mediaContentAnalysis: Record<string, ClipContentAnalysis>;
  gridSize: MediaLibraryGridSize;
  projectFrameRate: number;
  onCreateFolder(parentId?: string | null): void;
  onRenameFolder(folderId: string, name: string): void;
  onDeleteFolder(folderId: string): void;
  onSetFolderCollapsed(folderId: string, collapsed: boolean): void;
  onMoveMediaToFolder(assetIds: string[], folderId?: string | null): void;
  onAddToTimeline(assetId: string): void;
  onAddVersion(assetId: string): void;
  onCompareVersions(assetId: string): void;
  onRelink(assetId: string): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onBatchTranscode(paths: string[]): void;
  onExportGif(asset: MediaAsset): void;
  onAnalyzeSpectrum(asset: MediaAsset): void;
  onShowInfo(asset: MediaAsset): void;
  onFindSources(asset: MediaAsset): void;
  selectedMediaIds: Set<string>;
  onToggleSelected(assetId: string): void;
  onOpenBatchMetadata(assetId: string): void;
  onOpenBatchRename(assetId: string): void;
}) {
  const roots = props.folders.filter((folder) => !folder.parentId);
  if (roots.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2" data-testid="media-folder-tree">
      {roots.map((folder) => (
        <MediaFolderNode key={folder.id} folder={folder} depth={1} {...props} />
      ))}
    </div>
  );
}


function MediaFolderNode({
  folder,
  depth,
  folders,
  media,
  mediaMetadata,
  mediaContentAnalysis,
  gridSize,
  projectFrameRate,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSetFolderCollapsed,
  onMoveMediaToFolder,
  onAddToTimeline,
  onAddVersion,
  onCompareVersions,
  onRelink,
  onGenerateProxy,
  onConvertToCfr,
  onSetLabel,
  onSetRating,
  onSetFlag,
  onBatchTranscode,
  onExportGif,
  onAnalyzeSpectrum,
  onShowInfo,
  onFindSources,
  selectedMediaIds,
  onToggleSelected,
  onOpenBatchMetadata,
  onOpenBatchRename,
}: {
  folder: MediaFolder;
  depth: number;
  folders: MediaFolder[];
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  mediaContentAnalysis: Record<string, ClipContentAnalysis>;
  gridSize: MediaLibraryGridSize;
  projectFrameRate: number;
  onCreateFolder(parentId?: string | null): void;
  onRenameFolder(folderId: string, name: string): void;
  onDeleteFolder(folderId: string): void;
  onSetFolderCollapsed(folderId: string, collapsed: boolean): void;
  onMoveMediaToFolder(assetIds: string[], folderId?: string | null): void;
  onAddToTimeline(assetId: string): void;
  onAddVersion(assetId: string): void;
  onCompareVersions(assetId: string): void;
  onRelink(assetId: string): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onBatchTranscode(paths: string[]): void;
  onExportGif(asset: MediaAsset): void;
  onAnalyzeSpectrum(asset: MediaAsset): void;
  onShowInfo(asset: MediaAsset): void;
  onFindSources(asset: MediaAsset): void;
  selectedMediaIds: Set<string>;
  onToggleSelected(assetId: string): void;
  onOpenBatchMetadata(assetId: string): void;
  onOpenBatchRename(assetId: string): void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const children = folders.filter((item) => item.parentId === folder.id);
  const folderMedia = media.filter((asset) => asset.folderId === folder.id);
  const canNest = getMediaFolderDepth(folders, folder.id) < MAX_MEDIA_FOLDER_DEPTH;
  const commitRename = () => {
    setEditing(false);
    if (draftName.trim() && draftName.trim() !== folder.name) {
      onRenameFolder(folder.id, draftName);
    } else {
      setDraftName(folder.name);
    }
  };
  return (
    <div className="space-y-2" style={{ marginLeft: `${(depth - 1) * 12}px` }}>
      <div
        className="flex min-h-10 items-center gap-2 rounded-md border border-line bg-panel px-2 text-xs"
        data-testid={`media-folder-${folder.id}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const assetId = event.dataTransfer.getData(MEDIA_CARD_DRAG_MIME);
          if (assetId) {
            onMoveMediaToFolder([assetId], folder.id);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onDeleteFolder(folder.id);
        }}
      >
        <button
          className="rounded p-1 hover:bg-[var(--color-bg-secondary)]"
          type="button"
          data-testid={`media-folder-toggle-${folder.id}`}
          onClick={() => onSetFolderCollapsed(folder.id, !folder.collapsed)}
        >
          {folder.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Folder size={15} className="text-brand" />
        {editing ? (
          <input
            className="min-w-0 flex-1 rounded-lg border border-line px-1 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
            value={draftName}
            autoFocus
            data-testid={`media-folder-name-input-${folder.id}`}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitRename();
              }
              if (event.key === 'Escape') {
                setDraftName(folder.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className="min-w-0 flex-1 truncate text-left font-semibold text-[var(--color-text-secondary)]"
            type="button"
            data-testid={`media-folder-name-${folder.id}`}
            onDoubleClick={() => setEditing(true)}
          >
            {folder.name}
          </button>
        )}
        <span className="text-[var(--color-text-muted)]">{folderMedia.length}</span>
        <button
          className="rounded p-1 hover:bg-[var(--color-bg-secondary)] disabled:opacity-40"
          type="button"
          title={zhCN.mediaBin.newSubfolder}
          data-testid={`media-folder-add-child-${folder.id}`}
          disabled={!canNest}
          onClick={() => onCreateFolder(folder.id)}
        >
          <FolderPlus size={13} />
        </button>
        <button
          className="rounded p-1 text-rose-600 hover:bg-[var(--color-bg-secondary)]"
          type="button"
          title={zhCN.common.delete}
          data-testid={`media-folder-delete-${folder.id}`}
          onClick={() => onDeleteFolder(folder.id)}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {!folder.collapsed ? (
        <div className="space-y-2">
          {children.map((child) => (
            <MediaFolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              folders={folders}
              media={media}
              mediaMetadata={mediaMetadata}
              mediaContentAnalysis={mediaContentAnalysis}
              gridSize={gridSize}
              projectFrameRate={projectFrameRate}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onSetFolderCollapsed={onSetFolderCollapsed}
              onMoveMediaToFolder={onMoveMediaToFolder}
              onAddToTimeline={onAddToTimeline}
              onAddVersion={onAddVersion}
              onCompareVersions={onCompareVersions}
              onRelink={onRelink}
              onGenerateProxy={onGenerateProxy}
              onConvertToCfr={onConvertToCfr}
              onSetLabel={onSetLabel}
              onSetRating={onSetRating}
              onSetFlag={onSetFlag}
              onBatchTranscode={onBatchTranscode}
              onExportGif={onExportGif}
              onAnalyzeSpectrum={onAnalyzeSpectrum}
              onShowInfo={onShowInfo}
              onFindSources={onFindSources}
              selectedMediaIds={selectedMediaIds}
              onToggleSelected={onToggleSelected}
              onOpenBatchMetadata={onOpenBatchMetadata}
              onOpenBatchRename={onOpenBatchRename}
            />
          ))}
          <MediaCardGrid
            media={folderMedia}
            mediaMetadata={mediaMetadata}
            mediaContentAnalysis={mediaContentAnalysis}
            gridSize={gridSize}
            projectFrameRate={projectFrameRate}
            onAddToTimeline={onAddToTimeline}
            onAddVersion={onAddVersion}
            onCompareVersions={onCompareVersions}
            onRelink={onRelink}
            onGenerateProxy={onGenerateProxy}
            onConvertToCfr={onConvertToCfr}
            onSetLabel={onSetLabel}
            onSetRating={onSetRating}
            onSetFlag={onSetFlag}
            onBatchTranscode={onBatchTranscode}
            onExportGif={onExportGif}
            onAnalyzeSpectrum={onAnalyzeSpectrum}
            onShowInfo={onShowInfo}
            onFindSources={onFindSources}
            selectedMediaIds={selectedMediaIds}
            onToggleSelected={onToggleSelected}
            onOpenBatchMetadata={onOpenBatchMetadata}
            onOpenBatchRename={onOpenBatchRename}
            folderId={folder.id}
          />
        </div>
      ) : null}
    </div>
  );
}

function RootMediaDropZone({
