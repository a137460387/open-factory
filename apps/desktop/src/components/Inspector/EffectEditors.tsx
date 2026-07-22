import { useEffect, useState } from 'react';
import {
  AUDIO_SPECTRUM_POSITIONS,
  AUDIO_SPECTRUM_STYLES,
  BUILTIN_AUDIO_VISUALIZATION_THEMES,
  CUSTOM_SHADER_EXAMPLES,
  DEFAULT_EFFECT_PARAMS,
  EFFECT_TYPES,
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  MOTION_BLUR_SAMPLE_COUNTS,
  getEffectNumberParam,
  getEffectStringParam,
  normalizeAudioSpectrumParams,
  normalizeCustomShaderParams,
  normalizeMotionBlurParams,
  type Effect,
  type EffectPatch,
  type EffectType,
  type MotionGraphicParamDefinition,
} from '@open-factory/editor-core';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { validateCustomShaderSource } from '../../lib/preview/custom-shader';
import { resolveSliderKeyboardValue } from '../../accessibility/keyboard-navigation';
import { getEffectParamConfig } from './InspectorEditors';

export function EffectsEditor({
  effects,
  onAdd,
  onRemove,
  onUpdate,
  onReorder,
}: {
  effects: Effect[];
  onAdd(type: EffectType): void;
  onRemove(effectId: string): void;
  onUpdate(effectId: string, patch: EffectPatch): void;
  onReorder(effectIds: string[]): void;
}) {
  const [selectedType, setSelectedType] = useState<EffectType>('blur');
  const [draggedEffectId, setDraggedEffectId] = useState<string | null>(null);
  const moveEffect = (effectId: string, direction: -1 | 1) => {
    const index = effects.findIndex((effect) => effect.id === effectId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= effects.length) {
      return;
    }
    const ids = effects.map((effect) => effect.id);
    const [removed] = ids.splice(index, 1);
    ids.splice(targetIndex, 0, removed);
    onReorder(ids);
  };
  const dropEffect = (targetEffectId: string) => {
    if (!draggedEffectId || draggedEffectId === targetEffectId) {
      return;
    }
    const ids = effects.map((effect) => effect.id);
    const from = ids.indexOf(draggedEffectId);
    const to = ids.indexOf(targetEffectId);
    if (from === -1 || to === -1) {
      return;
    }
    const [removed] = ids.splice(from, 1);
    ids.splice(to, 0, removed);
    onReorder(ids);
    setDraggedEffectId(null);
  };

  return (
    <div className="space-y-3 rounded-md border border-line bg-panel p-2" data-testid="effects-editor">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1 text-xs font-medium text-[var(--color-text-secondary)]">
          {zhCN.inspector.fields.effectType}
          <select
            className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
            value={selectedType}
            data-testid="effect-type-select"
            onChange={(event) => setSelectedType(event.target.value as EffectType)}
          >
            {EFFECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {zhCN.inspector.effectNames[type]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="flex h-9 items-center gap-2 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 text-sm font-medium hover:bg-panel"
          type="button"
          data-testid="add-effect-button"
          onClick={() => onAdd(selectedType)}
        >
          <Plus size={14} />
          {zhCN.inspector.fields.addEffect}
        </button>
      </div>
      <div className="space-y-2">
        {effects.map((effect, index) => (
          <details
            key={effect.id}
            className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
            open
            data-testid={`effect-item-${effect.type}`}
            draggable
            onDragStart={() => setDraggedEffectId(effect.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropEffect(effect.id)}
            onDragEnd={() => setDraggedEffectId(null)}
          >
            <summary className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm font-semibold text-[var(--color-text-secondary)]">
              <GripVertical size={14} className="shrink-0 text-[var(--color-text-muted)]" />
              <span className="min-w-0 flex-1 truncate">{zhCN.inspector.effectNames[effect.type]}</span>
              <label
                className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-muted)]"
                onClick={(event) => event.stopPropagation()}
              >
                {zhCN.inspector.fields.enabled}
                <input
                  className="h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={effect.enabled}
                  data-testid={`effect-enabled-${effect.id}`}
                  onChange={(event) => onUpdate(effect.id, { enabled: event.target.checked })}
                />
              </label>
            </summary>
            <div className="space-y-3 border-t border-line p-2">
              {effect.type === 'audio-spectrum' ? (
                <AudioSpectrumEffectFields effect={effect} onUpdate={onUpdate} />
              ) : effect.type === 'custom-shader' ? (
                <CustomShaderEffectFields effect={effect} onUpdate={onUpdate} />
              ) : effect.type === 'motion-blur' ? (
                <MotionBlurEffectFields effect={effect} onUpdate={onUpdate} />
              ) : (
                getEffectParamConfig(effect.type).map((param) => (
                  <RangeNumberField
                    key={param.key}
                    label={param.label}
                    value={Number(effect.params[param.key] ?? DEFAULT_EFFECT_PARAMS[effect.type][param.key])}
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    format={(value) => value.toFixed(param.step < 1 ? 2 : 0)}
                    onCommit={(value) => onUpdate(effect.id, { params: { [param.key]: value } })}
                    testId={`effect-param-${effect.id}-${param.key}`}
                  />
                ))
              )}
              <div className="flex justify-end gap-2">
                <button
                  className="h-8 w-8 rounded-md border border-line bg-[var(--color-bg-elevated)] p-1 hover:bg-panel disabled:opacity-40"
                  type="button"
                  title={zhCN.inspector.fields.moveEffectUp}
                  disabled={index === 0}
                  onClick={() => moveEffect(effect.id, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="h-8 w-8 rounded-md border border-line bg-[var(--color-bg-elevated)] p-1 hover:bg-panel disabled:opacity-40"
                  type="button"
                  title={zhCN.inspector.fields.moveEffectDown}
                  disabled={index === effects.length - 1}
                  onClick={() => moveEffect(effect.id, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="h-8 w-8 rounded-md border border-rose-300 bg-[var(--color-bg-elevated)] p-1 text-rose-700 hover:bg-rose-50"
                  type="button"
                  title={zhCN.inspector.fields.removeEffect}
                  data-testid={`remove-effect-${effect.id}`}
                  onClick={() => onRemove(effect.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export function formatMotionGraphicNumberValue(param: MotionGraphicParamDefinition, value: number): string {
  if (param.max !== undefined && param.min === 0 && param.max <= 1.001) {
    return `${Math.round(value * 100)}%`;
  }
  if ((param.step ?? 1) < 1) {
    return value.toFixed(2);
  }
  return `${Math.round(value)}`;
}

export function TextField({
  label,
  value,
  onCommit,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  onCommit(value: string): void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        defaultValue={value}
        disabled={disabled}
        data-testid={testId}
        onBlur={(event) => onCommit(event.target.value)}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onCommit,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  onCommit(value: string): void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
      <textarea
        className="mt-1 min-h-20 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
        defaultValue={value}
        disabled={disabled}
        onBlur={(event) => onCommit(event.target.value)}
        data-testid={testId}
      />
    </label>
  );
}

export function CustomShaderEffectFields({
  effect,
  onUpdate,
}: {
  effect: Effect;
  onUpdate(effectId: string, patch: EffectPatch): void;
}) {
  const params = normalizeCustomShaderParams(effect.params);
  const [source, setSource] = useState(params.source);
  const [compileError, setCompileError] = useState<string | undefined>();

  useEffect(() => {
    setSource(params.source);
    setCompileError(undefined);
  }, [effect.id, params.source]);

  const compile = (nextSource: string): boolean => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
      setCompileError(zhCN.inspector.customShader.webglUnavailable);
      return false;
    }
    const result = validateCustomShaderSource(gl, nextSource);
    setCompileError(result.ok ? undefined : (result.error ?? zhCN.inspector.customShader.compileFailed));
    return result.ok;
  };

  const commitSource = (nextSource: string) => {
    const trimmed = nextSource.trim() || params.source;
    setSource(trimmed);
    if (compile(trimmed)) {
      onUpdate(effect.id, { params: { source: trimmed, preset: 'custom' } });
    }
  };

  const applyExample = (exampleId: string) => {
    const example = CUSTOM_SHADER_EXAMPLES.find((item) => item.id === exampleId);
    if (!example) {
      return;
    }
    setSource(example.source);
    setCompileError(undefined);
    onUpdate(effect.id, { params: { source: example.source, preset: example.id } });
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.shaderExample}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          value={params.preset}
          data-testid="custom-shader-example-select"
          onChange={(event) => applyExample(event.target.value)}
        >
          {CUSTOM_SHADER_EXAMPLES.map((example) => (
            <option key={example.id} value={example.id}>
              {zhCN.inspector.customShader.examples[example.id]}
            </option>
          ))}
          <option value="custom">{zhCN.inspector.customShader.custom}</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.shaderCode}
        <textarea
          className="mt-1 min-h-48 w-full resize-y rounded-md border border-line bg-slate-950 px-2 py-2 font-mono text-xs leading-5 text-slate-50 outline-none focus:ring-2 focus:ring-brand"
          value={source}
          spellCheck={false}
          data-testid={`effect-param-${effect.id}-shader-source`}
          onChange={(event) => {
            setSource(event.target.value);
            if (compileError) {
              setCompileError(undefined);
            }
          }}
          onBlur={(event) => commitSource(event.target.value)}
        />
      </label>
      {compileError ? (
        <div
          className="rounded-md border border-rose-200 bg-rose-50 p-2 font-mono text-[11px] leading-4 text-rose-800"
          data-testid="custom-shader-error"
        >
          {compileError}
        </div>
      ) : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
  hideLabel = false,
  testId,
  disabled,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit(value: number): void;
  hideLabel?: boolean;
  testId?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(formatNumberInputValue(value));
  useEffect(() => {
    setDraft(formatNumberInputValue(value));
  }, [value]);
  const commitDraft = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(formatNumberInputValue(value));
      return;
    }
    const clamped = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, parsed));
    setDraft(formatNumberInputValue(clamped));
    onCommit(clamped);
  };
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      {hideLabel ? <span className="sr-only">{label}</span> : label}
      <input
        className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step ?? 1}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        data-testid={testId}
      />
    </label>
  );
}

export function AudioSpectrumEffectFields({
  effect,
  onUpdate,
}: {
  effect: Effect;
  onUpdate(effectId: string, patch: EffectPatch): void;
}) {
  const params = normalizeAudioSpectrumParams(effect.params);
  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.style}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          value={getEffectStringParam(effect.params, 'style', params.style)}
          data-testid={`effect-param-${effect.id}-style`}
          onChange={(event) => onUpdate(effect.id, { params: { style: event.target.value } })}
        >
          {AUDIO_SPECTRUM_STYLES.map((style) => (
            <option key={style} value={style}>
              {zhCN.inspector.audioSpectrumStyles[style]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.exportDialog.audioVisualization.theme}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          value={getEffectStringParam(effect.params, 'themeId', params.themeId)}
          data-testid={`effect-param-${effect.id}-theme`}
          onChange={(event) => onUpdate(effect.id, { params: { themeId: event.target.value } })}
        >
          <option value={MANUAL_AUDIO_VISUALIZATION_THEME_ID}>
            {zhCN.exportDialog.audioVisualization.manualTheme}
          </option>
          {BUILTIN_AUDIO_VISUALIZATION_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </label>
      <ColorField
        label={zhCN.inspector.fields.colorStart}
        value={getEffectStringParam(effect.params, 'colorStart', params.colorStart)}
        onCommit={(colorStart) => onUpdate(effect.id, { params: { color: colorStart, colorStart } })}
        testId={`effect-param-${effect.id}-color-start`}
      />
      <ColorField
        label={zhCN.inspector.fields.colorEnd}
        value={getEffectStringParam(effect.params, 'colorEnd', params.colorEnd)}
        onCommit={(colorEnd) => onUpdate(effect.id, { params: { colorEnd } })}
        testId={`effect-param-${effect.id}-color-end`}
      />
      <RangeNumberField
        label={zhCN.inspector.fields.height}
        value={getEffectNumberParam(effect.params, 'height', params.height)}
        min={0}
        max={50}
        step={1}
        format={(value) => `${Math.round(value)}%`}
        onCommit={(height) => onUpdate(effect.id, { params: { height } })}
        testId={`effect-param-${effect.id}-height`}
      />
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.position}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          value={getEffectStringParam(effect.params, 'position', params.position)}
          data-testid={`effect-param-${effect.id}-position`}
          onChange={(event) => onUpdate(effect.id, { params: { position: event.target.value } })}
        >
          {AUDIO_SPECTRUM_POSITIONS.map((position) => (
            <option key={position} value={position}>
              {zhCN.inspector.audioSpectrumPositions[position]}
            </option>
          ))}
        </select>
      </label>
      <RangeNumberField
        label={zhCN.inspector.fields.sensitivity}
        value={getEffectNumberParam(effect.params, 'sensitivity', params.sensitivity)}
        min={0.1}
        max={4}
        step={0.1}
        format={(value) => value.toFixed(1)}
        onCommit={(sensitivity) => onUpdate(effect.id, { params: { sensitivity } })}
        testId={`effect-param-${effect.id}-sensitivity`}
      />
      <ToggleField
        label={zhCN.inspector.fields.mirror}
        checked={params.mirror}
        onCommit={(mirror) => onUpdate(effect.id, { params: { mirror } })}
        testId={`effect-param-${effect.id}-mirror`}
      />
    </div>
  );
}

export function MotionBlurEffectFields({
  effect,
  onUpdate,
}: {
  effect: Effect;
  onUpdate(effectId: string, patch: EffectPatch): void;
}) {
  const params = normalizeMotionBlurParams(effect.params);
  return (
    <div className="space-y-3">
      <RangeNumberField
        label={zhCN.inspector.fields.intensity}
        value={params.intensity}
        min={0}
        max={1}
        step={0.01}
        format={(value) => value.toFixed(2)}
        onCommit={(intensity) => onUpdate(effect.id, { params: { intensity } })}
        testId={`effect-param-${effect.id}-intensity`}
      />
      <RangeNumberField
        label={zhCN.inspector.fields.angle}
        value={params.angle}
        min={0}
        max={360}
        step={1}
        format={(value) => `${Math.round(value)}°`}
        onCommit={(angle) => onUpdate(effect.id, { params: { angle } })}
        testId={`effect-param-${effect.id}-angle`}
      />
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.samples}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          value={params.samples}
          data-testid={`effect-param-${effect.id}-samples`}
          onChange={(event) => onUpdate(effect.id, { params: { samples: Number(event.target.value) } })}
        >
          {MOTION_BLUR_SAMPLE_COUNTS.map((samples) => (
            <option key={samples} value={samples}>
              {samples}
            </option>
          ))}
        </select>
      </label>
      <RangeNumberField
        label={zhCN.inspector.fields.jitter}
        value={params.jitter}
        min={0}
        max={1}
        step={0.01}
        format={(value) => value.toFixed(2)}
        onCommit={(jitter) => onUpdate(effect.id, { params: { jitter } })}
        testId={`effect-param-${effect.id}-jitter`}
      />
    </div>
  );
}

export function formatNumberInputValue(value: number): string {
  return String(Number(value.toFixed(3)));
}

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
  hideLabel = false,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format(value: number): string;
  onCommit(value: number): void;
  hideLabel?: boolean;
  testId?: string;
}) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      <span className="flex justify-between">
        <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </span>
      <input
        className="mt-1 w-full accent-brand"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onCommit(Number(event.target.value))}
        onKeyDown={(event) => {
          const next = resolveSliderKeyboardValue({ key: event.key, value, min, max, step, shiftKey: event.shiftKey });
          if (next === undefined) {
            return;
          }
          event.preventDefault();
          onCommit(next);
        }}
        data-testid={testId}
      />
    </label>
  );
}

export function RangeNumberField({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
  disabled,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format(value: number): string;
  onCommit(value: number): void;
  disabled?: boolean;
  testId?: string;
}) {
  const commitClamped = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) {
      return;
    }
    onCommit(Math.min(max, Math.max(min, nextValue)));
  };
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <input
          className="w-20 rounded-lg border border-line px-2 py-1 text-right text-xs tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          type="number"
          value={Number(value.toFixed(3))}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => commitClamped(Number(event.target.value))}
          aria-label={label}
          data-testid={testId}
        />
      </span>
      <span className="mt-1 flex items-center gap-2">
        <input
          className="min-w-0 flex-1 accent-brand disabled:cursor-not-allowed disabled:opacity-60"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => commitClamped(Number(event.target.value))}
          onKeyDown={(event) => {
            const next = resolveSliderKeyboardValue({
              key: event.key,
              value,
              min,
              max,
              step,
              shiftKey: event.shiftKey,
            });
            if (next === undefined) {
              return;
            }
            event.preventDefault();
            commitClamped(next);
          }}
        />
        <span className="w-14 text-right text-xs tabular-nums text-[var(--color-text-muted)]">{format(value)}</span>
      </span>
    </label>
  );
}

export function ExpressionNumberField({
  label,
  value,
  format,
  onCommit,
  testId,
}: {
  label: string;
  value: number;
  format(value: number): string;
  onCommit(expression: string): void;
  testId?: string;
}) {
  const [draft, setDraft] = useState(formatNumberInputValue(value));
  useEffect(() => {
    setDraft(formatNumberInputValue(value));
  }, [value]);
  const commitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(formatNumberInputValue(value));
      return;
    }
    onCommit(trimmed);
    setDraft(formatNumberInputValue(value));
  };
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="text-[11px] font-normal tabular-nums text-[var(--color-text-muted)]">{format(value)}</span>
      </span>
      <input
        className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
        type="text"
        value={draft}
        data-testid={testId}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function ColorField({
  label,
  value,
  onCommit,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  onCommit(value: string): void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className="flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
      <input
        className="h-8 w-12 rounded border border-line disabled:cursor-not-allowed disabled:opacity-60"
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => onCommit(event.target.value)}
        data-testid={testId}
      />
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  disabled,
  onCommit,
  testId,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCommit(value: boolean): void;
  testId?: string;
}) {
  return (
    <label className="flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
      <input
        className="h-4 w-4 accent-brand disabled:cursor-not-allowed disabled:opacity-60"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCommit(event.target.checked)}
        data-testid={testId}
      />
    </label>
  );
}
