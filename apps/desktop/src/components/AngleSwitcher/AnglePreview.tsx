import React from 'react';
import type { MulticamClipAngle } from '@open-factory/editor-core';

interface AnglePreviewProps {
  angle: MulticamClipAngle;
  isActive: boolean;
  onClick: () => void;
  currentTime: number;
}

export const AnglePreview: React.FC<AnglePreviewProps> = ({
  angle,
  isActive,
  onClick,
  currentTime
}) => {
  return (
    <div
      className={`angle-preview ${isActive ? 'active' : ''}`}
      onClick={onClick}
      data-testid={`angle-preview-${angle.id}`}
    >
      <div className="angle-preview-container">
        {/* 视频预览将在这里渲染 */}
        <div className="angle-preview-placeholder">
          <span className="angle-name">{angle.name}</span>
          <span className="angle-timecode">{formatTimecode(currentTime)}</span>
        </div>
      </div>
      <div className="angle-info">
        <span className="angle-badge">{angle.id.split('-')[1]}</span>
        <span className="angle-status">
          {angle.muted ? '🔇' : '🔊'}
        </span>
      </div>
    </div>
  );
};

function formatTimecode(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);  // 假设30fps

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}
