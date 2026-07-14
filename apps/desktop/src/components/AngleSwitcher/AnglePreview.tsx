import React, { useRef, useEffect } from 'react';
import type { MulticamClipAngle, MediaAsset, Sequence, ProjectColorPipeline, Track } from '@open-factory/editor-core';
import { PreviewRenderer } from '../../lib/preview/renderer';

interface AnglePreviewProps {
  angle: MulticamClipAngle; isActive: boolean; onClick: () => void; currentTime: number;
  angleTrack?: Track; media: MediaAsset[]; sequences: Sequence[]; colorPipeline?: ProjectColorPipeline;
}

const angleRenderers = new Map<string, PreviewRenderer>();
function getAngleRenderer(angleId: string): PreviewRenderer {
  const existing = angleRenderers.get(angleId); if (existing) return existing;
  const renderer = new PreviewRenderer(); angleRenderers.set(angleId, renderer); return renderer;
}

export const AnglePreview: React.FC<AnglePreviewProps> = ({ angle, isActive, onClick, currentTime, angleTrack, media, sequences, colorPipeline }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !angleTrack) return;
    let canceled = false; const renderer = getAngleRenderer(angle.id);
    const angleTimeline = { tracks: [{ ...angleTrack, solo: false, muted: false }], transitions: [], markers: [] };
    void (async () => {
      try { await renderer.render(canvas, angleTimeline, media, currentTime, { sequences, colorPipeline }); }
      catch { if (!canceled) { const ctx = canvas.getContext('2d'); ctx?.clearRect(0, 0, canvas.width, canvas.height); } }
    })();
    return () => { canceled = true; };
  }, [angle.id, angleTrack, currentTime, media, sequences, colorPipeline]);

  return (
    <div className={`angle-preview ${isActive ? 'active' : ''}`} onClick={onClick} data-testid={`angle-preview-${angle.id}`}>
      <div className="angle-preview-container">
        <canvas ref={canvasRef} width={320} height={180} className="h-full w-full object-cover" data-testid={`angle-canvas-${angle.id}`} />
      </div>
      <div className="angle-info">
        <span className="angle-badge">{angle.id.split('-')[1]}</span>
        <span className="angle-timecode">{formatTimecode(currentTime)}</span>
        <span className="angle-status">{angle.muted ? '🔇' : '🔊'}</span>
      </div>
    </div>
  );
};

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60), f = Math.floor((seconds % 1) * 30);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`;
}
