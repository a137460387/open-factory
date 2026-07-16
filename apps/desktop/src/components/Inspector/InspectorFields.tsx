import { useEffect, useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { resolveSliderKeyboardValue } from '../../accessibility/keyboard-navigation';

function formatNumberInputValue(value: number): string {
  return String(Number(value.toFixed(3)));
}

export function PanelTitle() {
  return (
    <div className="flex items-center gap-2 border-b border-line px-3 py-2">
      <SlidersHorizontal size={16} />
      <div>
        <div className="text-sm font-semibold">{zhCN.inspector.title}</div>
        <div className="text-xs text-[var(--color-text-muted)]">{zhCN.inspector.subtitle}</div>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export const TextField = function TextField({
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
};

export const TextAreaField = function TextAreaField({
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
};

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

export function AnimatedField({
  label,
  children,
  onAddKeyframe,
  disabled,
  testId,
}: {
  label: string;
  children: ReactNode;
  onAddKeyframe(): void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
      <div>
        <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">{label}</div>
        {children}
      </div>
      <button
        className="mb-0.5 h-8 w-8 rounded-md border border-line bg-[var(--color-bg-elevated)] text-xs font-semibold text-brand hover:bg-panel"
        type="button"
        title={zhCN.inspector.addKeyframeTitle(label)}
        disabled={disabled}
        data-testid={testId ?? `add-${label.toLowerCase()}-keyframe-button`}
        onClick={onAddKeyframe}
      >
        ◆
      </button>
    </div>
  );
}
