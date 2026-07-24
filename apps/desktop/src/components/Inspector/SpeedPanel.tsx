import React from 'react';
import {
  CLIP_SLOW_MOTION_MODES,
  FRAME_INTERPOLATION_MODES,
  FRAME_INTERPOLATION_TARGET_FPS,
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
  getClipSpeed,
  frameInterpolationCompareModeToSlowMotionMode,
  type ClipSlowMotionMode,
  type FrameInterpolationMode,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import {
  Section,
  NumberField,
  RangeNumberField,
  ToggleField,
  AnimatedField,
} from './InspectorFields';
import { SpeedCurveEditor, formatEstimatedDuration } from './InspectorEditors';
import type { ClipInspectorBodyProps } from './ClipInspectorBody';

export function SpeedPanel({
  clip,
  asset,
  projectSettings,
  clipStartTimecode,
  clipDurationTimecode,
  showSlowMotionMode,
  slowMotionMode,
  frameInterpolation,
  frameInterpolationUnavailable,
  frameInterpolationCompareRunning,
  frameInterpolationCompareItems,
  frameInterpolationCompareError,
  frameInterpolationExpandedMode,
  setFrameInterpolationExpandedMode,
  frameInterpolationExpandedItem,
  frameInterpolationQualityRunning,
  frameInterpolationQualityError,
  commit,
  addKeyframe,
  runFrameInterpolationComparePreview,
  runFrameInterpolationQualityEvaluation,
}: ClipInspectorBodyProps) {
  if (clip.type !== 'video' && clip.type !== 'audio') return null;

  return (
    <>
      {/* Speed */}
      <Section title={zhCN.inspector.sections.speed}>
        <div className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]">
          {zhCN.inspector.timecodeSummary(clipStartTimecode, clipDurationTimecode)} /{' '}
          {zhCN.inspector.speedSummary(getClipSpeed(clip).toFixed(2))}
        </div>
        <AnimatedField label={zhCN.inspector.fields.speed} onAddKeyframe={() => addKeyframe('speed')} testId="add-speed-keyframe-button">
          <RangeNumberField label={zhCN.inspector.fields.speed} value={getClipSpeed(clip)} min={MIN_CLIP_SPEED} max={MAX_CLIP_SPEED} step={0.05} format={(value) => `${value.toFixed(2)}x`} onCommit={(speed) => commit({ speed })} testId="clip-speed-input" />
        </AnimatedField>
        {showSlowMotionMode ? (
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {zhCN.inspector.fields.slowMotionMode}
            <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={slowMotionMode} data-testid="clip-slow-motion-mode-select" onChange={(event) => commit({ slowMotionMode: event.target.value as ClipSlowMotionMode })}>
              {CLIP_SLOW_MOTION_MODES.map((mode) => (<option key={mode} value={mode}>{zhCN.inspector.slowMotionModes[mode]}</option>))}
            </select>
          </label>
        ) : null}
        <SpeedCurveEditor clip={clip} onCommit={(speedFrames) => commit({ keyframes: { ...clip.keyframes, speed: speedFrames } })} />
      </Section>

      {/* Frame Interpolation */}
      {clip.type === 'video' ? (
        <Section title={zhCN.inspector.sections.frameInterpolation}>
          <ToggleField label={zhCN.inspector.fields.enabled} checked={frameInterpolation.enabled} disabled={frameInterpolationUnavailable} onCommit={(enabled) => commit({ frameInterpolation: { ...frameInterpolation, enabled } })} testId="frame-interpolation-toggle" />
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            <span>{zhCN.inspector.fields.targetFrameRate}</span>
            <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60" value={frameInterpolation.targetFps} disabled={frameInterpolationUnavailable || !frameInterpolation.enabled} onChange={(event) => commit({ frameInterpolation: { ...frameInterpolation, targetFps: Number(event.target.value) as typeof frameInterpolation.targetFps } })} data-testid="frame-interpolation-fps-select">
              {FRAME_INTERPOLATION_TARGET_FPS.map((fps) => (<option key={fps} value={fps}>{fps} fps</option>))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            <span>{zhCN.inspector.frameInterpolationCompare.modeLabel}</span>
            <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60" value={frameInterpolation.mode} disabled={frameInterpolationUnavailable || !frameInterpolation.enabled} onChange={(event) => commit({ frameInterpolation: { ...frameInterpolation, mode: event.target.value as FrameInterpolationMode } })} data-testid="frame-interpolation-mode-select">
              {FRAME_INTERPOLATION_MODES.map((mode) => (<option key={mode} value={mode}>{zhCN.inspector.frameInterpolationCompare.modeLabels[mode]}</option>))}
            </select>
          </label>
          <NumberField label={zhCN.inspector.frameInterpolationCompare.protectionFrames} value={frameInterpolation.protectionFrames} min={0} max={5} step={1} disabled={frameInterpolationUnavailable || !frameInterpolation.enabled} onCommit={(protectionFrames) => commit({ frameInterpolation: { ...frameInterpolation, protectionFrames } })} testId="frame-interpolation-protection-input" />
          <div className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]" data-testid="frame-interpolation-quality-status">
            <div className="font-semibold text-ink">{zhCN.inspector.frameInterpolationCompare.qualityLabel}:{frameInterpolation.quality ? zhCN.inspector.frameInterpolationCompare.qualityGrades[frameInterpolation.quality.grade] : zhCN.inspector.frameInterpolationCompare.qualityNotEvaluated}</div>
            {frameInterpolation.quality ? (<div className="mt-1 text-[var(--color-text-secondary)]" data-testid="frame-interpolation-quality-ssim">{zhCN.inspector.frameInterpolationCompare.qualitySsim(frameInterpolation.quality.ssim, frameInterpolation.quality.sampleCount)}</div>) : null}
          </div>
          <button className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium text-ink hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60" type="button" data-testid="frame-interpolation-quality-button" disabled={frameInterpolationQualityRunning || frameInterpolationUnavailable || !frameInterpolation.enabled || !asset} onClick={() => void runFrameInterpolationQualityEvaluation()}>
            {frameInterpolationQualityRunning ? zhCN.inspector.frameInterpolationCompare.qualityRunning : zhCN.inspector.frameInterpolationCompare.qualityButton}
          </button>
          {frameInterpolationQualityError ? (<div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700" data-testid="frame-interpolation-quality-error">{frameInterpolationQualityError}</div>) : null}
          {frameInterpolationUnavailable ? (<div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800" data-testid="frame-interpolation-unavailable">{zhCN.inspector.fields.frameInterpolationUnsupported}</div>) : null}
          <button className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium text-ink hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60" type="button" data-testid="frame-interpolation-compare-button" disabled={frameInterpolationCompareRunning || frameInterpolationUnavailable || !asset} onClick={() => void runFrameInterpolationComparePreview()}>
            {frameInterpolationCompareRunning ? zhCN.inspector.frameInterpolationCompare.running : zhCN.inspector.frameInterpolationCompare.button}
          </button>
          {frameInterpolationCompareError ? (<div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700" data-testid="frame-interpolation-compare-error">{frameInterpolationCompareError}</div>) : null}
          {frameInterpolationCompareItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-2" data-testid="frame-interpolation-compare-grid">
              {frameInterpolationCompareItems.map((item) => (
                <div key={item.mode} className="overflow-hidden rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid={`frame-interpolation-compare-tile-${item.mode}`}>
                  <button type="button" className="block aspect-video w-full bg-black" onClick={() => setFrameInterpolationExpandedMode(item.mode)} aria-label={zhCN.inspector.frameInterpolationCompare.zoom(item.label)}>
                    <img className="h-full w-full object-contain" src={item.src} alt={item.label} data-testid="frame-interpolation-compare-image" />
                  </button>
                  <div className="space-y-1 p-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink"><span>{item.label}</span><span className="text-[var(--color-text-muted)]">{formatEstimatedDuration(item.estimatedMs)}</span></div>
                    <button type="button" className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs font-medium text-ink hover:bg-[var(--color-bg-elevated)]" data-testid={`frame-interpolation-select-${item.mode}`} onClick={() => commit({ slowMotionMode: frameInterpolationCompareModeToSlowMotionMode(item.mode) })}>
                      {slowMotionMode === item.slowMotionMode ? zhCN.inspector.frameInterpolationCompare.selected : zhCN.inspector.frameInterpolationCompare.selectMode}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {frameInterpolationExpandedItem ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" data-testid="frame-interpolation-compare-expanded" role="dialog" aria-modal="true">
              <div className="max-h-full max-w-5xl rounded-md bg-[var(--color-bg-elevated)] p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-ink">
                  <span>{frameInterpolationExpandedItem.label}</span>
                  <button type="button" className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" onClick={() => setFrameInterpolationExpandedMode(undefined)}>{zhCN.common.close}</button>
                </div>
                <img className="max-h-[70vh] max-w-full object-contain" src={frameInterpolationExpandedItem.src} alt={frameInterpolationExpandedItem.label} data-testid="frame-interpolation-compare-expanded-image" />
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}
