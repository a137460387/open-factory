import React, { useState, useEffect, useCallback } from 'react';
import type { MulticamClip, MulticamSyncMode } from '@open-factory/editor-core';
import { MulticamPreviewGrid } from './MulticamPreviewGrid';

interface AngleSwitcherPanelProps {
  multicamClip: MulticamClip;
  currentTime: number;
  onAngleSwitch: (angleIndex: number, time: number) => void;
  onSyncRequest: (mode: MulticamSyncMode) => void;
  onSwitchPointAdd: (time: number, targetAngle: number) => void;
  onSwitchPointDelete: (index: number) => void;
}

export const AngleSwitcherPanel: React.FC<AngleSwitcherPanelProps> = ({
  multicamClip,
  currentTime,
  onAngleSwitch,
  onSyncRequest,
  onSwitchPointAdd,
  onSwitchPointDelete
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [syncMode, setSyncMode] = useState<MulticamSyncMode>('audio');

  // 键盘快捷键处理
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key;

    // 数字键1-9切换机位
    if (key >= '1' && key <= '9') {
      const angleIndex = parseInt(key) - 1;
      if (angleIndex < multicamClip.angles.length) {
        onAngleSwitch(angleIndex, currentTime);
      }
    }

    // 空格键播放/暂停（由父组件处理）
    // 左右箭头逐帧移动（由父组件处理）
  }, [multicamClip.angles.length, currentTime, onAngleSwitch]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={`angle-switcher-panel ${isExpanded ? 'expanded' : 'collapsed'}`}
      data-testid="angle-switcher-panel"
    >
      <div className="panel-header">
        <button
          className="toggle-button"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="toggle-angle-switcher"
        >
          {isExpanded ? '▼' : '▶'} 多机位
        </button>
        <div className="sync-controls">
          <select
            value={syncMode}
            onChange={(e) => setSyncMode(e.target.value as MulticamSyncMode)}
          >
            <option value="audio">音频同步</option>
            <option value="timecode">时间码同步</option>
            <option value="manual">手动标记</option>
          </select>
          <button
            onClick={() => onSyncRequest(syncMode)}
            data-testid="sync-button"
          >
            同步
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="panel-content">
          <MulticamPreviewGrid
            multicamClip={multicamClip}
            currentTime={currentTime}
            onAngleSwitch={(angleIndex) => onAngleSwitch(angleIndex, currentTime)}
          />

          <div className="switch-points-info">
            <span>切换点: {multicamClip.switchPoints.length}</span>
            <button
              onClick={() => onSwitchPointAdd(currentTime, multicamClip.activeAngle)}
              data-testid="add-switch-point"
            >
              添加切换点
            </button>
            {multicamClip.switchPoints.length > 0 && (
              <div className="switch-points-list" data-testid="switch-points-list">
                {multicamClip.switchPoints.map((point, index) => (
                  <div key={index} className="switch-point-item">
                    <span>
                      #{index + 1} - {point.time.toFixed(2)}s → 机位 {point.targetAngle + 1}
                    </span>
                    <button
                      onClick={() => onSwitchPointDelete(index)}
                      data-testid={`delete-switch-point-${index}`}
                      title="删除切换点"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
