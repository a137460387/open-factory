import React, { useState, useEffect, useCallback } from 'react';
import type { MulticamClip, MulticamSyncMode, SwitchPoint } from '@open-factory/editor-core';
import { MulticamPreviewGrid } from './MulticamPreviewGrid';
import { SyncControls } from './SyncControls';
import { SwitchPointEditor } from './SwitchPointEditor';

interface AngleSwitcherPanelProps {
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
}

export const AngleSwitcherPanel: React.FC<AngleSwitcherPanelProps> = ({
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
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // 键盘快捷键处理
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
    <div className={`angle-switcher-panel ${isExpanded ? 'expanded' : 'collapsed'}`} data-testid="angle-switcher-panel">
      <div className="panel-header">
        <button
          className="toggle-button"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="toggle-angle-switcher"
        >
          {isExpanded ? '▼' : '▶'} 多机位
        </button>
      </div>

      {isExpanded && (
        <div className="panel-content">
          <MulticamPreviewGrid
            multicamClip={multicamClip}
            currentTime={currentTime}
            onAngleSwitch={(angleIndex) => onAngleSwitch(angleIndex, currentTime)}
          />

          <SyncControls onSyncRequest={onSyncRequest} onDriftDetection={onDriftDetection} isSyncing={isSyncing} />

          <SwitchPointEditor
            switchPoints={multicamClip.switchPoints}
            angles={multicamClip.angles}
            currentTime={currentTime}
            onSwitchPointAdd={onSwitchPointAdd}
            onSwitchPointDelete={onSwitchPointDelete}
            onSwitchPointUpdate={onSwitchPointUpdate}
          />
        </div>
      )}
    </div>
  );
};
