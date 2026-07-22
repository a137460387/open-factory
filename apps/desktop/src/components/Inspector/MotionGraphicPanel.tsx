import type {
  Clip,
  MotionGraphicParamDefinition,
  MotionGraphicParamValue,
  MotionGraphicTemplateType,
} from '@open-factory/editor-core';
import {
  createDefaultMotionGraphic,
  getMotionGraphicTemplateDefinition,
  MOTION_GRAPHIC_TEMPLATE_TYPES,
  normalizeMotionGraphic,
  setMotionGraphicParam,
  setMotionGraphicParamKeyframe,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { UpdateClipCommand } from '@open-factory/editor-core';
import { showToast } from '../../lib/toast';
import { Section, AnimatedField, RangeNumberField, TextField, ColorField, ToggleField, formatMotionGraphicNumberValue } from './InspectorEditors';

export function MotionGraphicPanel({
  clip,
  selectedClipLocked,
  playheadTime,
}: {
  clip: Extract<Clip, { type: 'motion-graphic' }>;
  selectedClipLocked: boolean;
  playheadTime: number;
}) {
  const motionGraphicsText = zhCN.motionGraphics;
  const motionGraphic = normalizeMotionGraphic(clip.motionGraphic, clip.duration);
  const definition = getMotionGraphicTemplateDefinition(motionGraphic.templateType);
  const selectOptions = motionGraphicsText.selectOptions as Record<string, Record<string, string>>;
  const localKeyframeTime = Math.min(clip.duration, Math.max(0, playheadTime - clip.start));
  const commitMotionGraphic = (
    next: Partial<Extract<Clip, { type: 'motion-graphic' }>['motionGraphic']> | undefined,
  ) => {
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, { motionGraphic: next }));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };
  const commitTemplate = (templateType: MotionGraphicTemplateType) => {
    commitMotionGraphic(createDefaultMotionGraphic(templateType));
  };
  const commitParam = (param: MotionGraphicParamDefinition, value: MotionGraphicParamValue) => {
    commitMotionGraphic(setMotionGraphicParam(motionGraphic, param.key, value, clip.duration));
  };
  const addParamKeyframe = (param: MotionGraphicParamDefinition) => {
    if (param.type !== 'number' || !param.keyframeable) {
      return;
    }
    const value = motionGraphic.params[param.key];
    if (typeof value !== 'number') {
      return;
    }
    try {
      commitMotionGraphic(
        setMotionGraphicParamKeyframe(motionGraphic, param.key, { time: localKeyframeTime, value }, clip.duration),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.addKeyframeFailed,
      });
    }
  };

  return (
    <Section title={motionGraphicsText.title}>
      {selectedClipLocked ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
          {zhCN.inspector.locked}
        </div>
      ) : null}
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {motionGraphicsText.template}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          value={motionGraphic.templateType}
          disabled={selectedClipLocked}
          data-testid="motion-graphic-template-select"
          onChange={(event) => commitTemplate(event.target.value as MotionGraphicTemplateType)}
        >
          {MOTION_GRAPHIC_TEMPLATE_TYPES.map((templateType) => (
            <option key={templateType} value={templateType}>
              {motionGraphicsText.templates[templateType].name}
            </option>
          ))}
        </select>
        <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
          {motionGraphicsText.templates[motionGraphic.templateType].description}
        </div>
      </label>
      <div className="space-y-3">
        {definition.params.map((param) => {
          const label = motionGraphicsText.fields[param.key as keyof typeof motionGraphicsText.fields] ?? param.key;
          const currentValue = motionGraphic.params[param.key];
          const testId = `motion-graphic-param-${param.key}`;
          if (param.type === 'number') {
            const numberValue =
              typeof currentValue === 'number'
                ? currentValue
                : typeof param.defaultValue === 'number'
                  ? param.defaultValue
                  : 0;
            const field = (
              <RangeNumberField
                label={label}
                value={numberValue}
                min={param.min ?? 0}
                max={param.max ?? Math.max(numberValue, param.min ?? 100)}
                step={param.step ?? 1}
                format={(value) => formatMotionGraphicNumberValue(param, value)}
                disabled={selectedClipLocked}
                onCommit={(value) => commitParam(param, value)}
                testId={testId}
              />
            );
            return param.keyframeable ? (
              <AnimatedField
                key={param.key}
                label={label}
                disabled={selectedClipLocked}
                onAddKeyframe={() => addParamKeyframe(param)}
                testId={`add-motion-graphic-${param.key}-keyframe-button`}
              >
                {field}
              </AnimatedField>
            ) : (
              <div key={param.key}>{field}</div>
            );
          }
          if (param.type === 'string') {
            return (
              <TextField
                key={param.key}
                label={label}
                value={typeof currentValue === 'string' ? currentValue : String(param.defaultValue ?? '')}
                disabled={selectedClipLocked}
                testId={testId}
                onCommit={(value) => commitParam(param, value)}
              />
            );
          }
          if (param.type === 'color') {
            return (
              <ColorField
                key={param.key}
                label={label}
                value={typeof currentValue === 'string' ? currentValue : String(param.defaultValue ?? '#ffffff')}
                disabled={selectedClipLocked}
                testId={testId}
                onCommit={(value) => commitParam(param, value)}
              />
            );
          }
          if (param.type === 'boolean') {
            return (
              <ToggleField
                key={param.key}
                label={label}
                checked={typeof currentValue === 'boolean' ? currentValue : Boolean(param.defaultValue)}
                disabled={selectedClipLocked}
                testId={testId}
                onCommit={(value) => commitParam(param, value)}
              />
            );
          }
          if (param.type === 'select') {
            const value = typeof currentValue === 'string' ? currentValue : String(param.defaultValue ?? '');
            return (
              <label key={param.key} className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {label}
                <select
                  className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  value={value}
                  disabled={selectedClipLocked}
                  data-testid={testId}
                  onChange={(event) => commitParam(param, event.target.value)}
                >
                  {(param.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {selectOptions[param.key]?.[option] ?? option}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          const value = Array.isArray(currentValue)
            ? currentValue.join(', ')
            : Array.isArray(param.defaultValue)
              ? param.defaultValue.join(', ')
              : '';
          return (
            <TextField
              key={param.key}
              label={label}
              value={value}
              disabled={selectedClipLocked}
              testId={testId}
              onCommit={(nextValue) => commitParam(param, nextValue)}
            />
          );
        })}
      </div>
    </Section>
  );
}
