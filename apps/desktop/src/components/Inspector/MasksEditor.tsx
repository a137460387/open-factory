import type { ClipMask, MaskPatch, PrivacyBlurEffect } from '@open-factory/editor-core';
import { normalizePrivacyBlurEffect } from '@open-factory/editor-core';
import { Plus, Trash2 } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { RangeNumberField, ToggleField } from './EffectEditors';

export function MasksEditor({
  masks,
  onAdd,
  onUpdate,
  onRemove,
}: {
  masks: ClipMask[];
  onAdd(): void;
  onUpdate(maskId: string, patch: MaskPatch): void;
  onRemove(maskId: string): void;
}) {
  return (
    <div className="space-y-3" data-testid="masks-editor">
      <button
        className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
        type="button"
        data-testid="add-mask-button"
        onClick={onAdd}
      >
        <Plus size={14} />
        {zhCN.inspector.fields.addMask}
      </button>
      {masks.map((mask, index) => (
        <details
          key={mask.id}
          className="rounded-md border border-line bg-panel"
          open
          data-testid={`mask-item-${mask.id}`}
        >
          <summary className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            <span className="min-w-0 flex-1 truncate">{`${zhCN.inspector.sections.masks} ${index + 1}`}</span>
            <label
              className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-muted)]"
              onClick={(event) => event.stopPropagation()}
            >
              {zhCN.inspector.fields.enabled}
              <input
                className="h-4 w-4 accent-brand"
                type="checkbox"
                checked={mask.enabled}
                data-testid={`mask-enabled-${mask.id}`}
                onChange={(event) => onUpdate(mask.id, { enabled: event.target.checked })}
              />
            </label>
          </summary>
          <div className="space-y-3 border-t border-line p-2">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.inspector.fields.maskType}
              <select
                className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                value={mask.type}
                data-testid={`mask-type-${mask.id}`}
                onChange={(event) => onUpdate(mask.id, { type: event.target.value as ClipMask['type'] })}
              >
                <option value="rect">{zhCN.inspector.fields.rectMask}</option>
                <option value="ellipse">{zhCN.inspector.fields.ellipseMask}</option>
                <option value="path">{zhCN.inspector.fields.pathMask}</option>
              </select>
            </label>
            {mask.type === 'path' ? (
              <div
                className="rounded-md border border-dashed border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs text-[var(--color-text-muted)]"
                data-testid={`path-mask-help-${mask.id}`}
              >
                <div>
                  {zhCN.inspector.fields.pathPointCount(
                    Math.max(
                      0,
                      (mask.path?.length ?? 0) -
                        (mask.path &&
                        mask.path.length > 1 &&
                        mask.path[0].x === mask.path.at(-1)?.x &&
                        mask.path[0].y === mask.path.at(-1)?.y
                          ? 1
                          : 0),
                    ),
                  )}
                </div>
                <div>{zhCN.inspector.fields.editPathInPreview}</div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <RangeNumberField
                label="X"
                value={mask.x}
                min={0}
                max={1}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onCommit={(x) => onUpdate(mask.id, { x })}
                testId={`mask-x-${mask.id}`}
              />
              <RangeNumberField
                label="Y"
                value={mask.y}
                min={0}
                max={1}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onCommit={(y) => onUpdate(mask.id, { y })}
                testId={`mask-y-${mask.id}`}
              />
              <RangeNumberField
                label="W"
                value={mask.w}
                min={0.001}
                max={1}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onCommit={(w) => onUpdate(mask.id, { w })}
                testId={`mask-w-${mask.id}`}
              />
              <RangeNumberField
                label="H"
                value={mask.h}
                min={0.001}
                max={1}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onCommit={(h) => onUpdate(mask.id, { h })}
                testId={`mask-h-${mask.id}`}
              />
            </div>
            <RangeNumberField
              label={zhCN.inspector.fields.feather}
              value={mask.feather}
              min={0}
              max={1}
              step={0.01}
              format={(value) => value.toFixed(2)}
              onCommit={(feather) => onUpdate(mask.id, { feather })}
              testId={`mask-feather-${mask.id}`}
            />
            <ToggleField
              label={zhCN.inspector.fields.inverted}
              checked={mask.inverted}
              onCommit={(inverted) => onUpdate(mask.id, { inverted })}
              testId={`mask-inverted-${mask.id}`}
            />
            <div
              className="space-y-2 rounded-md border border-line bg-[var(--color-bg-elevated)] p-2"
              data-testid={`mask-privacy-blur-${mask.id}`}
            >
              <ToggleField
                label={zhCN.inspector.fields.privacyBlurEnabled}
                checked={mask.privacyBlur?.enabled === true}
                onCommit={(enabled) =>
                  onUpdate(mask.id, {
                    privacyBlur: {
                      enabled,
                      effect: normalizePrivacyBlurEffect(mask.privacyBlur?.effect),
                      color: mask.privacyBlur?.color,
                    },
                  })
                }
                testId={`mask-privacy-blur-enabled-${mask.id}`}
              />
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.inspector.fields.privacyBlurEffect}
                <select
                  className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  value={normalizePrivacyBlurEffect(mask.privacyBlur?.effect)}
                  disabled={mask.privacyBlur?.enabled !== true}
                  data-testid={`mask-privacy-blur-effect-${mask.id}`}
                  onChange={(event) =>
                    onUpdate(mask.id, {
                      privacyBlur: {
                        enabled: true,
                        effect: normalizePrivacyBlurEffect(event.target.value as PrivacyBlurEffect),
                        color: mask.privacyBlur?.color,
                      },
                    })
                  }
                >
                  <option value="pixelize">{zhCN.inspector.privacyBlur.effects.pixelize}</option>
                  <option value="gblur">{zhCN.inspector.privacyBlur.effects.gblur}</option>
                  <option value="solid">{zhCN.inspector.privacyBlur.effects.solid}</option>
                </select>
              </label>
              {normalizePrivacyBlurEffect(mask.privacyBlur?.effect) === 'solid' ? (
                <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                  {zhCN.inspector.fields.privacyBlurSolidColor}
                  <input
                    className="mt-1 h-8 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    type="color"
                    value={mask.privacyBlur?.color ?? '#000000'}
                    disabled={mask.privacyBlur?.enabled !== true}
                    data-testid={`mask-privacy-blur-color-${mask.id}`}
                    onChange={(event) =>
                      onUpdate(mask.id, {
                        privacyBlur: {
                          enabled: true,
                          effect: 'solid',
                          color: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              ) : null}
            </div>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-300 bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
              type="button"
              data-testid={`remove-mask-${mask.id}`}
              onClick={() => onRemove(mask.id)}
            >
              <Trash2 size={14} />
              {zhCN.inspector.fields.removeMask}
            </button>
          </div>
        </details>
      ))}
    </div>
  );
}
