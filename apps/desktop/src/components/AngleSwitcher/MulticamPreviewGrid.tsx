import React, { useMemo } from 'react';
import type { MulticamClip, Track } from '@open-factory/editor-core';
import { createId } from '@open-factory/editor-core';
import { useEditorStore } from '../../store/editorStore';
import { AnglePreview } from './AnglePreview';

interface MulticamPreviewGridProps {
  multicamClip: MulticamClip;
  currentTime: number;
  onAngleSwitch: (angleIndex: number) => void;
}

export const MulticamPreviewGrid: React.FC<MulticamPreviewGridProps> = ({
  multicamClip,
  currentTime,
  onAngleSwitch,
}) => {
  const { angles, activeAngle } = multicamClip;
  const project = useEditorStore((state) => state.project);
  const angleTracks = useMemo(() => {
    const tracks = new Map<string, Track>();
    for (const angle of angles) {
      const asset = project.media.find((m) => m.id === angle.mediaId);
      if (!asset) continue;
      tracks.set(angle.id, {
        id: `multicam-preview-track-${angle.id}`,
        type: 'video' as const,
        name: angle.name,
        clips: [
          {
            id: createId('clip'),
            type: 'video' as const,
            name: asset.name,
            trackId: `multicam-preview-track-${angle.id}`,
            mediaId: asset.id,
            start: 0,
            duration: asset.duration,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            volume: angle.volume,
            muted: angle.muted,
            colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
            transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          },
        ],
      });
    }
    return tracks;
  }, [angles, project.media]);

  return (
    <div
      className={`multicam-preview-grid ${angles.length <= 2 ? 'layout-1x2' : angles.length <= 4 ? 'layout-2x2' : angles.length <= 6 ? 'layout-2x3' : 'layout-3x3'}`}
      data-testid="multicam-preview-grid"
    >
      {angles.map((angle, index) => (
        <AnglePreview
          key={angle.id}
          angle={angle}
          isActive={index === activeAngle}
          onClick={() => onAngleSwitch(index)}
          currentTime={currentTime}
          angleTrack={angleTracks.get(angle.id)}
          media={project.media}
          sequences={project.sequences}
          colorPipeline={project.settings.colorPipeline}
        />
      ))}
    </div>
  );
};
