import React, { useState } from 'react';
import type { MulticamSyncMode } from '@open-factory/editor-core';

interface DriftResult {
  driftDetected: boolean;
  driftRate: number;
}

interface SyncControlsProps {
  onSyncRequest: (mode: MulticamSyncMode) => void;
  onDriftDetection: () => Promise<DriftResult | undefined>;
  isSyncing: boolean;
}

export const SyncControls: React.FC<SyncControlsProps> = ({
  onSyncRequest,
  onDriftDetection,
  isSyncing
}) => {
  const [selectedMode, setSelectedMode] = useState<MulticamSyncMode>('audio');
  const [driftMessage, setDriftMessage] = useState<string | null>(null);

  const handleDriftDetection = async () => {
    setDriftMessage(null);
    const result = await onDriftDetection();
    if (!result) return;
    if (result.driftDetected) {
      setDriftMessage(`检测到时钟漂移: ${result.driftRate.toFixed(2)} 秒/小时`);
    } else {
      setDriftMessage('未检测到时钟漂移');
    }
  };

  return (
    <div className="sync-controls" data-testid="sync-controls">
      <div className="sync-mode-selector">
        <label>
          <input
            type="radio"
            value="audio"
            checked={selectedMode === 'audio'}
            onChange={(e) => setSelectedMode(e.target.value as MulticamSyncMode)}
          />
          音频波形
        </label>
        <label>
          <input
            type="radio"
            value="timecode"
            checked={selectedMode === 'timecode'}
            onChange={(e) => setSelectedMode(e.target.value as MulticamSyncMode)}
          />
          时间码
        </label>
        <label>
          <input
            type="radio"
            value="manual"
            checked={selectedMode === 'manual'}
            onChange={(e) => setSelectedMode(e.target.value as MulticamSyncMode)}
          />
          手动标记
        </label>
      </div>

      <div className="sync-actions">
        <button
          onClick={() => onSyncRequest(selectedMode)}
          disabled={isSyncing}
          data-testid="sync-button"
        >
          {isSyncing ? '同步中...' : '开始同步'}
        </button>

        <button
          onClick={handleDriftDetection}
          disabled={isSyncing}
          data-testid="drift-detection-button"
        >
          检测漂移
        </button>
      </div>

      {driftMessage && (
        <div className="drift-message" data-testid="drift-message">
          {driftMessage}
        </div>
      )}
    </div>
  );
};
