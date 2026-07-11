import React from 'react';
import type { SwitchPoint, MulticamClipAngle, SwitchTransition } from '@open-factory/editor-core';

interface SwitchPointEditorProps {
  switchPoints: SwitchPoint[];
  angles: MulticamClipAngle[];
  currentTime: number;
  onSwitchPointAdd: (time: number, targetAngle: number) => void;
  onSwitchPointDelete: (index: number) => void;
  onSwitchPointUpdate: (index: number, updates: Partial<SwitchPoint>) => void;
}

export const SwitchPointEditor: React.FC<SwitchPointEditorProps> = ({
  switchPoints,
  angles,
  currentTime,
  onSwitchPointAdd,
  onSwitchPointDelete,
  onSwitchPointUpdate
}) => {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${minutes}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  return (
    <div className="switch-point-editor" data-testid="switch-point-editor">
      <div className="editor-header">
        <h4>切换点</h4>
        <button
          onClick={() => onSwitchPointAdd(currentTime, 0)}
          data-testid="add-switch-point-button"
        >
          + 添加
        </button>
      </div>

      <div className="switch-points-list">
        {switchPoints.length === 0 ? (
          <div className="empty-state">无切换点</div>
        ) : (
          switchPoints.map((sp, index) => (
            <div
              key={index}
              className="switch-point-item"
              data-testid={`switch-point-${index}`}
            >
              <div className="switch-point-info">
                <span className="time">{formatTime(sp.time)}</span>
                <span className="arrow">&rarr;</span>
                <span className="angle">
                  {angles[sp.targetAngle]?.name || `机位 ${sp.targetAngle + 1}`}
                </span>
                <span className="transition">{sp.transition}</span>
              </div>

              <div className="switch-point-actions">
                <select
                  value={sp.targetAngle}
                  onChange={(e) => onSwitchPointUpdate(index, {
                    targetAngle: parseInt(e.target.value)
                  })}
                >
                  {angles.map((angle, i) => (
                    <option key={angle.id} value={i}>
                      {angle.name}
                    </option>
                  ))}
                </select>

                <select
                  value={sp.transition}
                  onChange={(e) => onSwitchPointUpdate(index, {
                    transition: e.target.value as SwitchTransition
                  })}
                >
                  <option value="cut">切换</option>
                  <option value="dissolve">溶解</option>
                  <option value="wipe">擦除</option>
                </select>

                <button
                  onClick={() => onSwitchPointDelete(index)}
                  className="delete-button"
                  data-testid={`delete-switch-point-${index}`}
                >
                  &times;
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
