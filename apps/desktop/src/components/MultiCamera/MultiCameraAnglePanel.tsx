import React, { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import type { MulticamClip, MulticamSyncMode, SwitchPoint, MulticamSyncStatusSummary } from '@open-factory/editor-core';
import {
  buildSyncStatusSummary,
  getSyncQualityColor,
  getSyncQualityLabel,
  formatOffsetDisplay,
} from '@open-factory/editor-core';
import { useEditorStore } from '../../store/editorStore';
import { useMixerStore } from '../../store/mixerStore';
import { useMulticamPreviewWorker } from '../../hooks/useMulticamPreviewWorker';

// ── 懒加载子组件 ──────────────────────────────────────────────

const MulticamPreviewGrid = lazy(() =>
  import('../AngleSwitcher/MulticamPreviewGrid').then((m) => ({ default: m.MulticamPreviewGrid })),
);

const SyncControls = lazy(() => import('../AngleSwitcher/SyncControls').then((m) => ({ default: m.SyncControls })));

const SwitchPointEditor = lazy(() =>
  import('../AngleSwitcher/SwitchPointEditor').then((m) => ({ default: m.SwitchPointEditor })),
);

// ── 类型定义 ──────────────────────────────────────────────────

interface MultiCameraAnglePanelProps {
  multicamClip: MulticamClip;
  currentTime: number;
  isPlaying: boolean;
  onAngleSwitch: (angleIndex: number, time: number) => void;
  onSyncRequest: (mode: MulticamSyncMode) => void;
  onSwitchPointAdd: (time: number, targetAngle: number) => void;
  onSwitchPointDelete: (index: number) => void;
  onSwitchPointUpdate: (index: number, updates: Partial<SwitchPoint>) => void;
  onDriftDetection: () => Promise<{ driftDetected: boolean; driftRate: number } | undefined>;
  isSyncing: boolean;
  syncStatus?: MulticamSyncStatusSummary;
}

// ── 同步状态指示器组件 ──────────────────────────────────────────

const SyncStatusIndicator: React.FC<{ status: MulticamSyncStatusSummary }> = ({ status }) => {
  const qualityColor = getSyncQualityColor(status.overallQuality);
  const qualityLabel = getSyncQualityLabel(status.overallQuality);

  return (
    <div className="sync-status-indicator" data-testid="sync-status-indicator">
      <div className="sync-quality-badge" style={{ backgroundColor: qualityColor }}>
        {qualityLabel}
      </div>
      <div className="sync-details">
        <span className="sync-confidence">置信度: {Math.round(status.averageConfidence * 100)}%</span>
        <span className="sync-max-offset">最大偏移: {formatOffsetDisplay(status.maxOffsetMs)}</span>
        {status.anyDriftDetected && (
          <span className="sync-drift-warning" data-testid="drift-warning">
            ⚠️ 时钟漂移
          </span>
        )}
      </div>
      {status.syncProgress < 1 && (
        <div className="sync-progress-bar">
          <div className="sync-progress-fill" style={{ width: `${status.syncProgress * 100}%` }} />
        </div>
      )}
    </div>
  );
};

// ── 机位同步偏移列表 ──────────────────────────────────────────

const AngleSyncOffsetList: React.FC<{ status: MulticamSyncStatusSummary }> = ({ status }) => (
  <div className="angle-sync-offsets" data-testid="angle-sync-offsets">
    {status.angleStatuses.map((angle) => (
      <div key={angle.angleId} className="angle-offset-row">
        <span className="angle-name">{angle.angleName}</span>
        <span className="angle-offset-value" style={{ color: getSyncQualityColor(angle.quality) }}>
          {formatOffsetDisplay(angle.offsetMs)}
        </span>
        <span className="angle-confidence">{Math.round(angle.confidence * 100)}%</span>
      </div>
    ))}
  </div>
);

// ── Worker 驱动的机位预览网格（OffscreenCanvas 渲染） ──────────

const WorkerPreviewCanvas: React.FC<{
  angleId: string;
  bitmap: ImageBitmap | null;
  isActive: boolean;
  angleName: string;
  onClick: () => void;
  width: number;
  height: number;
}> = ({ angleId, bitmap, isActive, angleName, onClick, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (bitmap) {
      // 使用 Worker 解码的 bitmap 直接绘制到 canvas
      ctx.drawImage(bitmap, 0, 0, width, height);
    } else {
      // 无帧数据时显示占位
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#888';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(angleName, width / 2, height / 2);
    }
  }, [bitmap, width, height, angleName]);

  return (
    <div
      className={`worker-angle-preview ${isActive ? 'active' : ''}`}
      onClick={onClick}
      data-testid={`worker-angle-preview-${angleId}`}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="angle-canvas"
        data-testid={`worker-angle-canvas-${angleId}`}
      />
      <div className="angle-overlay">
        <span className="angle-badge">{angleId.split('-')[1]}</span>
        {isActive && <span className="active-indicator">●</span>}
      </div>
    </div>
  );
};

// ── 混合预览网格：Worker 解码 + 回退到 DOM 渲染 ──────────────

const HybridPreviewGrid: React.FC<{
  multicamClip: MulticamClip;
  currentTime: number;
  onAngleSwitch: (angleIndex: number) => void;
}> = ({ multicamClip, currentTime, onAngleSwitch }) => {
  const project = useEditorStore((state) => state.project);
  const { requestFrames, frames, isReady } = useMulticamPreviewWorker();
  const PREVIEW_WIDTH = 320;
  const PREVIEW_HEIGHT = 180;

  // 通过 Worker 请求帧解码
  useEffect(() => {
    if (!isReady) return;

    requestFrames(
      multicamClip.angles.map((a) => ({ id: a.id, mediaId: a.mediaId })),
      currentTime + (multicamClip.angles[0]?.offset ?? 0),
      PREVIEW_WIDTH,
      PREVIEW_HEIGHT,
      (mediaId) => {
        const asset = project.media.find((m) => m.id === mediaId);
        return asset?.proxyPath ?? asset?.path ?? '';
      },
    );
  }, [isReady, multicamClip.angles, currentTime, project.media, requestFrames]);

  // Worker 不可用时回退到 DOM 渲染
  if (!isReady) {
    return (
      <Suspense fallback={<div className="loading-placeholder">加载预览中...</div>}>
        <MulticamPreviewGrid multicamClip={multicamClip} currentTime={currentTime} onAngleSwitch={onAngleSwitch} />
      </Suspense>
    );
  }

  return (
    <div
      className={`multicam-preview-grid worker-mode ${multicamClip.angles.length <= 2 ? 'layout-1x2' : multicamClip.angles.length <= 4 ? 'layout-2x2' : multicamClip.angles.length <= 6 ? 'layout-2x3' : 'layout-3x3'}`}
      data-testid="multicam-preview-grid"
    >
      {multicamClip.angles.map((angle, index) => (
        <WorkerPreviewCanvas
          key={angle.id}
          angleId={angle.id}
          bitmap={frames.get(angle.id)?.bitmap ?? null}
          isActive={index === multicamClip.activeAngle}
          angleName={angle.name}
          onClick={() => onAngleSwitch(index)}
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
        />
      ))}
    </div>
  );
};

// ── 主组件 ──────────────────────────────────────────────────

export const MultiCameraAnglePanel: React.FC<MultiCameraAnglePanelProps> = ({
  multicamClip,
  currentTime,
  isPlaying,
  onAngleSwitch,
  onSyncRequest,
  onSwitchPointAdd,
  onSwitchPointDelete,
  onSwitchPointUpdate,
  onDriftDetection,
  isSyncing,
  syncStatus,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSyncDetails, setShowSyncDetails] = useState(false);

  // 键盘快捷键处理：数字键 1-9 切换机位
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key;

      // 数字键1-9切换机位
      if (key >= '1' && key <= '9') {
        const angleIndex = parseInt(key) - 1;
        if (angleIndex < multicamClip.angles.length) {
          onAngleSwitch(angleIndex, currentTime);
        }
      }
    },
    [multicamClip.angles.length, currentTime, onAngleSwitch],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={`multi-camera-angle-panel ${isExpanded ? 'expanded' : 'collapsed'}`}
      data-testid="multi-camera-angle-panel"
    >
      {/* 面板头部 */}
      <div className="panel-header">
        <button
          className="toggle-button"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="toggle-multi-camera-panel"
        >
          {isExpanded ? '▼' : '▶'} 多机位编辑
        </button>

        {/* 快捷键提示 */}
        <div className="shortcut-hints" data-testid="shortcut-hints">
          {multicamClip.angles.slice(0, 9).map((_, index) => (
            <kbd key={index} className="shortcut-key">
              {index + 1}
            </kbd>
          ))}
        </div>
      </div>

      {isExpanded && (
        <div className="panel-content">
          {/* 同步状态指示器 */}
          {syncStatus && <SyncStatusIndicator status={syncStatus} />}

          {/* 多机位预览网格（Worker 驱动 + DOM 回退） */}
          <HybridPreviewGrid
            multicamClip={multicamClip}
            currentTime={currentTime}
            onAngleSwitch={(angleIndex) => onAngleSwitch(angleIndex, currentTime)}
          />

          {/* 同步控制 */}
          <Suspense fallback={null}>
            <SyncControls onSyncRequest={onSyncRequest} onDriftDetection={onDriftDetection} isSyncing={isSyncing} />
          </Suspense>

          {/* 同步详情（可展开） */}
          {syncStatus && (
            <div className="sync-details-section">
              <button
                className="toggle-sync-details"
                onClick={() => setShowSyncDetails(!showSyncDetails)}
                data-testid="toggle-sync-details"
              >
                {showSyncDetails ? '▼' : '▶'} 同步详情
              </button>
              {showSyncDetails && <AngleSyncOffsetList status={syncStatus} />}
            </div>
          )}

          {/* 切换点编辑器 */}
          <Suspense fallback={null}>
            <SwitchPointEditor
              switchPoints={multicamClip.switchPoints}
              angles={multicamClip.angles}
              currentTime={currentTime}
              onSwitchPointAdd={onSwitchPointAdd}
              onSwitchPointDelete={onSwitchPointDelete}
              onSwitchPointUpdate={onSwitchPointUpdate}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default MultiCameraAnglePanel;
