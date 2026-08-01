import type {NumberInputProps} from './types';
import {clampNumber, formatNumber} from './utils';

export function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onCommit,
  testId,
  compact = false,
}: NumberInputProps) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return (
    <label className={`block ${compact ? '' : 'text-xs font-medium text-slate-600'}`}>
      <span
        className={`mb-1 flex items-center justify-between gap-2 ${compact ? 'text-[11px] font-medium text-slate-500' : ''}`}
      >
        <span>{label}</span>
        {!compact ? <span className="tabular-nums">{formatNumber(value)}</span> : null}
      </span>
      <input
        className={`w-full rounded-md border border-line px-2 text-right tabular-nums text-ink ${compact ? 'h-7 text-[11px]' : 'h-9 text-sm'}`}
        type="number"
        value={formatNumber(safeValue)}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onCommit(clampNumber(Number(event.target.value), min, max))}
        data-testid={testId}
      />
    </label>
  );
}
