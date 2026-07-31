import type {KeyframeProperty} from '@open-factory/editor-core';
import {calculateBezierHandleCoordinates, calculateKeyframeSpeedSamples} from '@open-factory/editor-core';
import type {CanvasPoint, CurveEditorFrame, SpeedCurveFrame} from './sharedTypes';
import {curveFrameToPoint, getInterpolatedCurveEditorValue, getKeyframeFallbackForCurve, normalizeCurveEditorFrames, normalizeSpeedCurveFrames, speedFrameToPoint} from './keyframeData';

export function drawKeyframeCurveCanvas(
  canvas: HTMLCanvasElement,
  frames: CurveEditorFrame[],
  property: KeyframeProperty,
  duration: number,
  selectedIds: string[],
  selectionBox: { start: CanvasPoint; current: CanvasPoint } | null,
): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148,163,184,0.22)';
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += width / 4) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += height / 4) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }
  const points = frames.map((frame) => ({ frame, point: curveFrameToPoint(frame, property, duration, canvas) }));
  if (points.length > 1) {
    context.strokeStyle = '#38bdf8';
    context.lineWidth = 2;
    context.beginPath();
    for (let index = 0; index < points.length - 1; index += 1) {
      const left = points[index];
      const right = points[index + 1];
      for (let step = 0; step <= 20; step += 1) {
        const sampleTime = left.frame.time + ((right.frame.time - left.frame.time) * step) / 20;
        const sampleValue = getInterpolatedCurveEditorValue(left.frame, right.frame, sampleTime);
        const point = curveFrameToPoint(
          { id: 'sample', time: sampleTime, value: sampleValue, easing: 'linear' },
          property,
          duration,
          canvas,
        );
        if (index === 0 && step === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      }
    }
    context.stroke();
  }
  for (const [index, { frame, point }] of points.entries()) {
    if (!selectedIds.includes(frame.id)) {
      continue;
    }
    const coordinates = calculateBezierHandleCoordinates(
      frame,
      points[index - 1]?.frame,
      points[index + 1]?.frame,
      frame.handleMode ?? 'independent',
    );
    context.strokeStyle = 'rgba(251,191,36,0.85)';
    context.fillStyle = '#fbbf24';
    context.lineWidth = 1.5;
    for (const handle of [coordinates.inHandle, coordinates.outHandle]) {
      if (!handle) {
        continue;
      }
      const handlePoint = curveFrameToPoint(
        { id: 'handle', time: handle.time, value: handle.value, easing: 'linear' },
        property,
        duration,
        canvas,
      );
      context.save();
      context.setLineDash([3, 2]);
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(handlePoint.x, handlePoint.y);
      context.stroke();
      context.restore();
      context.beginPath();
      context.arc(handlePoint.x, handlePoint.y, 4.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(251,191,36,0.4)';
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = 'rgba(255,255,255,0.7)';
      context.beginPath();
      context.arc(handlePoint.x, handlePoint.y, 1.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fbbf24';
    }
  }
  for (const { frame, point } of points) {
    const selected = selectedIds.includes(frame.id);
    context.fillStyle = selected ? '#ffffff' : '#fb7185';
    context.strokeStyle = selected ? '#020617' : '#ffffff';
    context.lineWidth = selected ? 2 : 1;
    context.beginPath();
    context.arc(point.x, point.y, selected ? 5 : 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  if (selectionBox) {
    const left = Math.min(selectionBox.start.x, selectionBox.current.x);
    const top = Math.min(selectionBox.start.y, selectionBox.current.y);
    const boxWidth = Math.abs(selectionBox.current.x - selectionBox.start.x);
    const boxHeight = Math.abs(selectionBox.current.y - selectionBox.start.y);
    context.fillStyle = 'rgba(14,165,233,0.18)';
    context.strokeStyle = '#38bdf8';
    context.lineWidth = 1;
    context.fillRect(left, top, boxWidth, boxHeight);
    context.strokeRect(left, top, boxWidth, boxHeight);
  }
}

export function drawKeyframeVelocityCanvas(
  canvas: HTMLCanvasElement,
  frames: CurveEditorFrame[],
  property: KeyframeProperty,
  duration: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148,163,184,0.22)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();
  const fallback = frames[0]?.value ?? getKeyframeFallbackForCurve(property);
  const samples = calculateKeyframeSpeedSamples(frames, duration, fallback, 48);
  const maxAbs = Math.max(0.001, ...samples.map((sample) => Math.abs(sample.value)));
  context.strokeStyle = '#a78bfa';
  context.lineWidth = 2;
  context.beginPath();
  samples.forEach((sample, index) => {
    const x = (sample.time / Math.max(0.001, duration)) * width;
    const y = height / 2 - (sample.value / maxAbs) * (height * 0.42);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
}

export function drawSpeedCurveCanvas(canvas: HTMLCanvasElement, frames: SpeedCurveFrame[], duration: number): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  context.lineWidth = 1;
  for (let index = 1; index < 4; index += 1) {
    const x = (index / 4) * width;
    const y = (index / 4) * height;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  const normalized = normalizeSpeedCurveFrames(frames, duration);
  context.strokeStyle = '#2d6cdf';
  context.lineWidth = 2;
  context.beginPath();
  normalized.forEach((frame, index) => {
    const point = speedFrameToPoint(frame, duration, width, height);
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.stroke();
  for (const frame of normalized) {
    const point = speedFrameToPoint(frame, duration, width, height);
    context.beginPath();
    context.fillStyle = '#ffffff';
    context.arc(point.x, point.y, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#2d6cdf';
    context.lineWidth = 2;
    context.stroke();
  }
}
