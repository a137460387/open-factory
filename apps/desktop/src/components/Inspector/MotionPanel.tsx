import React from 'react';
import {
  ApplyShakeStabilizationCommand,
  ApplyPipPlacementCommand,
  KEYFRAME_PROPERTY_LIMITS,
  type KeyframeEasing,
  type KeyframeProperty,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { commandManager, projectAccessor } from '../../store/commandManager';
import { Section, NumberField, RangeNumberField, ExpressionNumberField } from './InspectorFields';
import { KeyframeCurveEditor, formatKeyframeProperty, formatKeyframeValue } from './KeyframeCurveEditor';
import type { ClipInspectorBodyProps } from './ClipInspectorBody';

export function MotionPanel({
  clip,
  selectedClipLocked,
  asset,
  selectedKeyframe,
  selectedKeyframes,
  setSelectedKeyframes,
  selectedKeyframeEntries,
  selectedKeyframeFrame,
  batchKeyframesSelected,
  batchShiftSeconds,
  setBatchShiftSeconds,
  batchScaleFactor,
  setBatchScaleFactor,
  batchEasing,
  setBatchEasing,
  curveProperty,
  setCurveProperty,
  keyframeProperties,
  motionTrack,
  motionTrackProgress,
  motionTrackingBusy,
  commit,
  updateSelectedKeyframe,
  removeSelectedKeyframe,
  shiftSelectedKeyframes,
  scaleSelectedKeyframes,
  updateSelectedKeyframeEasing,
  distributeSelectedKeyframes,
  alignSelectedKeyframeValues,
  deleteSelectedKeyframes,
  updateSelectedKeyframeExpression,
  updateCurveKeyframes,
  runMotionTrackAnalysis,
  cancelMotionTrackAnalysis,
  bindMotionTrackKeyframes,
}: ClipInspectorBodyProps) {
  return (
    <>
      {/* Shake Analysis */}
      {clip.type === 'video' && (clip.stabilization?.shakeScore ?? 0) > 50 ? (
        <Section title={zhCN.preview.shakeAnalysisTitle}>
          <div
            className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
            data-testid="shake-analysis-panel"
          >
            <span data-testid="shake-analysis-severity">
              {zhCN.preview.shakeAnalysisScore(clip.stabilization?.shakeScore ?? 0)}
            </span>
          </div>
          <button
            className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
            type="button"
            data-testid="apply-shake-stabilization"
            onClick={() => {
              const cmd = new ApplyShakeStabilizationCommand(projectAccessor, clip.id, { suggestedFilter: 'vidstab' });
              commandManager.execute(cmd);
            }}
          >
            {zhCN.preview.shakeAnalysisApplyAntiShake}
          </button>
        </Section>
      ) : null}

      {/* PiP Avoidance */}
      {clip.type === 'video' && clip.aiPipSuggestion ? (
        <Section title={zhCN.preview.pipAvoidanceTitle}>
          <div
            className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
            data-testid="pip-avoidance-panel"
          >
            <span>{zhCN.preview.pipAvoidanceWarning}</span>
          </div>
          <button
            className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
            type="button"
            data-testid="apply-pip-placement"
            onClick={() => {
              const cmd = new ApplyPipPlacementCommand(
                projectAccessor,
                clip.id,
                clip.aiPipSuggestion!.recommendedCorner,
              );
              commandManager.execute(cmd);
            }}
          >
            {zhCN.preview.pipAvoidanceApply}
          </button>
        </Section>
      ) : null}

      {/* Motion Track */}
      {clip.type === 'video' ? (
        <Section title={zhCN.inspector.sections.motionTrack}>
          <div
            className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
            data-testid="motion-track-status"
          >
            {motionTrackProgress !== undefined && motionTrackProgress < 1
              ? zhCN.inspector.motionTrack.progress(motionTrackProgress)
              : motionTrack.length > 0
                ? zhCN.inspector.motionTrack.pointCount(motionTrack.length)
                : zhCN.inspector.motionTrack.notAnalyzed}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={motionTrackingBusy}
              data-testid="analyze-motion-track-button"
              onClick={() => void runMotionTrackAnalysis()}
            >
              {zhCN.inspector.motionTrack.analyze}
            </button>
            <button
              className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!motionTrackingBusy}
              data-testid="cancel-motion-track-button"
              onClick={() => void cancelMotionTrackAnalysis()}
            >
              {zhCN.inspector.motionTrack.cancel}
            </button>
          </div>
          <button
            className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={motionTrack.length === 0}
            data-testid="bind-motion-track-button"
            onClick={bindMotionTrackKeyframes}
          >
            {zhCN.inspector.motionTrack.bind}
          </button>
        </Section>
      ) : null}

      {/* Batch Keyframes */}
      {batchKeyframesSelected ? (
        <Section title={zhCN.inspector.sections.keyframe}>
          <div
            className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
            data-testid="batch-keyframe-editor"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold text-[var(--color-text-secondary)]">
                {zhCN.inspector.batchKeyframes.title}
              </span>
              <span className="tabular-nums" data-testid="batch-keyframe-count">
                {zhCN.inspector.batchKeyframes.count(selectedKeyframeEntries.length)}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <NumberField
                label={zhCN.inspector.batchKeyframes.shiftSeconds}
                value={batchShiftSeconds}
                min={-60}
                max={60}
                step={0.01}
                onCommit={setBatchShiftSeconds}
                testId="batch-keyframe-shift-input"
              />
              <button
                className="mb-0.5 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                data-testid="batch-keyframe-shift-button"
                onClick={shiftSelectedKeyframes}
              >
                {zhCN.inspector.batchKeyframes.applyShift}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
              <NumberField
                label={zhCN.inspector.batchKeyframes.scaleFactor}
                value={batchScaleFactor}
                min={0.01}
                max={10}
                step={0.01}
                onCommit={setBatchScaleFactor}
                testId="batch-keyframe-scale-input"
              />
              <button
                className="mb-0.5 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                data-testid="batch-keyframe-scale-button"
                onClick={scaleSelectedKeyframes}
              >
                {zhCN.inspector.batchKeyframes.applyScale}
              </button>
            </div>
            <label className="mt-2 block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.inspector.fields.easing}
              <select
                className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                value={batchEasing}
                data-testid="batch-keyframe-easing-select"
                onChange={(event) => setBatchEasing(event.target.value as KeyframeEasing)}
              >
                <option value="linear">{zhCN.inspector.easing.linear}</option>
                <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
                <option value="ease-in-out">{zhCN.inspector.easing.easeInOut}</option>
                <option value="elastic">{zhCN.inspector.easing.elastic}</option>
                <option value="bounce">{zhCN.inspector.easing.bounce}</option>
              </select>
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                data-testid="batch-keyframe-easing-button"
                onClick={updateSelectedKeyframeEasing}
              >
                {zhCN.inspector.batchKeyframes.applyEasing}
              </button>
              <button
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                data-testid="batch-keyframe-distribute-time-button"
                onClick={distributeSelectedKeyframes}
              >
                {zhCN.inspector.batchKeyframes.distributeTime}
              </button>
              <button
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                data-testid="batch-keyframe-align-value-button"
                onClick={alignSelectedKeyframeValues}
              >
                {zhCN.inspector.batchKeyframes.alignValue}
              </button>
              <button
                className="rounded-md border border-rose-300 px-2 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                type="button"
                data-testid="batch-keyframe-delete-button"
                onClick={deleteSelectedKeyframes}
              >
                {zhCN.inspector.batchKeyframes.delete}
              </button>
            </div>
          </div>
        </Section>
      ) : null}

      {/* Single Keyframe */}
      {selectedKeyframe && selectedKeyframeFrame ? (
        <Section title={zhCN.inspector.sections.keyframe}>
          <div
            className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
            data-testid="selected-keyframe-editor"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold text-[var(--color-text-secondary)]">
                {formatKeyframeProperty(selectedKeyframe.property)}
              </span>
              <span className="tabular-nums">{selectedKeyframeFrame.time.toFixed(2)}s</span>
            </div>
            <RangeNumberField
              label={zhCN.inspector.fields.time}
              value={selectedKeyframeFrame.time}
              min={0}
              max={clip.duration}
              step={0.01}
              format={(value) => `${value.toFixed(2)}s`}
              onCommit={(time) => updateSelectedKeyframe({ time })}
            />
            <RangeNumberField
              label={zhCN.inspector.fields.value}
              value={selectedKeyframeFrame.value}
              min={KEYFRAME_PROPERTY_LIMITS[selectedKeyframe.property].min}
              max={KEYFRAME_PROPERTY_LIMITS[selectedKeyframe.property].max}
              step={0.01}
              format={(value) => formatKeyframeValue(selectedKeyframe.property, value)}
              onCommit={(value) => updateSelectedKeyframe({ value })}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ExpressionNumberField
                label={zhCN.inspector.fields.preciseTime}
                value={selectedKeyframeFrame.time}
                format={(value) => `${value.toFixed(2)}s`}
                onCommit={(expression) => updateSelectedKeyframeExpression('time', expression)}
                testId="selected-keyframe-time-expression"
              />
              <ExpressionNumberField
                label={zhCN.inspector.fields.preciseValue}
                value={selectedKeyframeFrame.value}
                format={(value) => formatKeyframeValue(selectedKeyframe.property, value)}
                onCommit={(expression) => updateSelectedKeyframeExpression('value', expression)}
                testId="selected-keyframe-value-expression"
              />
            </div>
            <label className="mt-2 block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.inspector.fields.easing}
              <select
                className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                value={selectedKeyframeFrame.easing}
                data-testid="selected-keyframe-easing"
                onChange={(event) => updateSelectedKeyframe({ easing: event.target.value as KeyframeEasing })}
              >
                <option value="linear">{zhCN.inspector.easing.linear}</option>
                <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
                <option value="ease-in-out">{zhCN.inspector.easing.easeInOut}</option>
                <option value="elastic">{zhCN.inspector.easing.elastic}</option>
                <option value="bounce">{zhCN.inspector.easing.bounce}</option>
              </select>
            </label>
            <button
              className="mt-2 w-full rounded-md border border-rose-300 px-2 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
              type="button"
              data-testid="remove-selected-keyframe-button"
              onClick={removeSelectedKeyframe}
            >
              {zhCN.inspector.removeKeyframe}
            </button>
          </div>
        </Section>
      ) : null}

      {/* Keyframe Curves */}
      {keyframeProperties.length > 0 ? (
        <Section title={zhCN.inspector.sections.curves}>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {zhCN.inspector.fields.property}
            <select
              className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={curveProperty}
              data-testid="keyframe-curve-property-select"
              onChange={(event) => setCurveProperty(event.target.value as KeyframeProperty)}
            >
              {keyframeProperties.map((property) => (
                <option key={property} value={property}>
                  {formatKeyframeProperty(property)}
                </option>
              ))}
            </select>
          </label>
          <KeyframeCurveEditor
            clip={clip}
            property={curveProperty}
            selectedKeyframes={selectedKeyframes ?? []}
            onSelectionChange={setSelectedKeyframes}
            onCommit={(frames) => updateCurveKeyframes(curveProperty, frames)}
          />
        </Section>
      ) : null}
    </>
  );
}
