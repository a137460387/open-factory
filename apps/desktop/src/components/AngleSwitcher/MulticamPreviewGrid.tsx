import React from 'react';
import type { MulticamClip } from '@open-factory/editor-core';
import { AnglePreview } from './AnglePreview';

interface MulticamPreviewGridProps {
  multicamClip: MulticamClip;
  currentTime: number;
  onAngleSwitch: (angleIndex: number) => void;
}

export const MulticamPreviewGrid: React.FC<MulticamPreviewGridProps> = ({
  multicamClip,
  currentTime,
  onAngleSwitch
}) => {
  const { angles, activeAngle } = multicamClip;

  // 根据机位数量确定布局
  const getLayoutClass = () => {
    const count = angles.length;
    if (count <= 2) return 'layout-1x2';
    if (count <= 4) return 'layout-2x2';
    if (count <= 6) return 'layout-2x3';
    return 'layout-3x3';
  };

  return (
    <div
      className={`multicam-preview-grid ${getLayoutClass()}`}
      data-testid="multicam-preview-grid"
    >
      {angles.map((angle, index) => (
        <AnglePreview
          key={angle.id}
          angle={angle}
          isActive={index === activeAngle}
          onClick={() => onAngleSwitch(index)}
          currentTime={currentTime}
        />
      ))}
    </div>
  );
};
