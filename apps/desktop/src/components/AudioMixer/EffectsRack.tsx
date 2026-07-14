import React, { useCallback, useMemo, useState } from 'react';
import type { AudioEffectSlot, AudioEffectType } from '@open-factory/editor-core';
import { createEffectSlot } from '@open-factory/editor-core';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';

interface EffectsRackProps {
  effects: AudioEffectSlot[];
  onChange: (effects: AudioEffectSlot[]) => void;
}

const EFFECT_LABELS: Record<AudioEffectType, string> = {
  'eq-4band': 'EQ 4段',
  'eq-8band': 'EQ 8段',
  compressor: '压缩器',
  limiter: '限制器',
  gate: '噪声门',
  expander: '扩展器',
  reverb: '混响',
  delay: '延迟',
  chorus: '合唱',
  flanger: '镶边',
  distortion: '失真',
  'de-esser': '齿音消除',
  'noise-reduction': '降噪',
  'pitch-shift': '变调',
  'stereo-widener': '立体声增强',
  'mid-side': 'M/S处理',
  gain: '增益',
  'phase-invert': '相位反转',
  'high-pass': '高通滤波',
  'low-pass': '低通滤波',
};

const PARAM_LABELS: Record<string, string> = {
  threshold: '阈值',
  ratio: '比率',
  attack: '起始',
  release: '释放',
  makeup: '补偿',
  roomSize: '房间大小',
  damping: '阻尼',
  wetLevel: '湿声',
  dryLevel: '干声',
  width: '宽度',
  time: '时间',
  feedback: '反馈',
  mix: '混合',
  frequency: '频率',
  resonance: '共振',
  gain: '增益',
  lowFreq: '低频',
  lowGain: '低增益',
  lowMidFreq: '低中频',
  lowMidGain: '低中增益',
  highMidFreq: '高中频',
  highMidGain: '高中增益',
  highFreq: '高频',
  highGain: '高增益',
  range: '范围',
  rate: '速率',
  depth: '深度',
  delay: '延迟',
  drive: '驱动',
  tone: '音色',
  level: '电平',
  reduction: '降噪量',
  semitones: '半音',
  cents: '音分',
  formantPreserve: '共振峰保持',
  midGain: '中间增益',
  sideGain: '侧边增益',
  invert: '反转',
  freq1: '频段1',
  gain1: '增益1',
  freq2: '频段2',
  gain2: '增益2',
  freq3: '频段3',
  gain3: '增益3',
  freq4: '频段4',
  gain4: '增益4',
  freq5: '频段5',
  gain5: '增益5',
  freq6: '频段6',
  gain6: '增益6',
  freq7: '频段7',
  gain7: '增益7',
  freq8: '频段8',
  gain8: '增益8',
};

/** [min, max, step] for each known parameter */
const PARAM_RANGES: Record<string, [number, number, number]> = {
  threshold: [-80, 0, 1],
  ratio: [1, 20, 0.5],
  attack: [0.01, 200, 1],
  release: [1, 1000, 10],
  makeup: [0, 24, 0.5],
  roomSize: [0, 100, 1],
  damping: [0, 100, 1],
  wetLevel: [0, 100, 1],
  dryLevel: [0, 100, 1],
  width: [0, 200, 1],
  time: [1, 2000, 10],
  feedback: [0, 95, 1],
  mix: [0, 100, 1],
  frequency: [20, 20000, 10],
  resonance: [0.1, 10, 0.1],
  gain: [-24, 24, 0.5],
  lowFreq: [20, 500, 10],
  lowGain: [-24, 24, 0.5],
  lowMidFreq: [200, 2000, 50],
  lowMidGain: [-24, 24, 0.5],
  highMidFreq: [1000, 8000, 100],
  highMidGain: [-24, 24, 0.5],
  highFreq: [4000, 20000, 500],
  highGain: [-24, 24, 0.5],
  range: [-80, 0, 1],
  rate: [0.1, 10, 0.1],
  depth: [0, 100, 1],
  delay: [0, 50, 1],
  drive: [0, 100, 1],
  tone: [0, 100, 1],
  level: [0, 100, 1],
  reduction: [0, 100, 1],
  semitones: [-24, 24, 1],
  cents: [-100, 100, 1],
  formantPreserve: [0, 1, 1],
  midGain: [-24, 24, 0.5],
  sideGain: [-24, 24, 0.5],
  invert: [0, 1, 1],
  freq1: [20, 20000, 10],
  gain1: [-24, 24, 0.5],
  freq2: [20, 20000, 10],
  gain2: [-24, 24, 0.5],
  freq3: [20, 20000, 10],
  gain3: [-24, 24, 0.5],
  freq4: [20, 20000, 10],
  gain4: [-24, 24, 0.5],
  freq5: [20, 20000, 10],
  gain5: [-24, 24, 0.5],
  freq6: [20, 20000, 10],
  gain6: [-24, 24, 0.5],
  freq7: [20, 20000, 10],
  gain7: [-24, 24, 0.5],
  freq8: [20, 20000, 10],
  gain8: [-24, 24, 0.5],
};

export function EffectsRack({ effects, onChange }: EffectsRackProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const sortedEffects = useMemo(() => [...effects].sort((a, b) => a.order - b.order), [effects]);

  const handleAddEffect = useCallback(
    (type: AudioEffectType) => {
      const newEffect = createEffectSlot(type);
      newEffect.order = effects.length;
      onChange([...effects, newEffect]);
      setAddMenuOpen(false);
    },
    [effects, onChange],
  );

  const handleRemoveEffect = useCallback(
    (id: string) => {
      const remaining = effects.filter((e) => e.id !== id);
      const reordered = remaining.map((e, i) => ({ ...e, order: i }));
      onChange(reordered);
    },
    [effects, onChange],
  );

  const handleToggleEffect = useCallback(
    (id: string) => {
      onChange(effects.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)));
    },
    [effects, onChange],
  );

  const handleParamChange = useCallback(
    (id: string, param: string, value: number) => {
      onChange(effects.map((e) => (e.id === id ? { ...e, params: { ...e.params, [param]: value } } : e)));
    },
    [effects, onChange],
  );

  const handleWetDryChange = useCallback(
    (id: string, value: number) => {
      onChange(effects.map((e) => (e.id === id ? { ...e, wetDry: value } : e)));
    },
    [effects, onChange],
  );

  const handleMoveEffect = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const sorted = [...effects].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((e) => e.id === id);
      if (index < 0) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return;
      const swapped = [...sorted];
      const temp = swapped[index]!.order;
      swapped[index]!.order = swapped[targetIndex]!.order;
      swapped[targetIndex]!.order = temp;
      onChange(swapped);
    },
    [effects, onChange],
  );

  return (
    <div className="flex min-h-0 flex-col bg-white" data-testid="effects-rack">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-700">效果链</h3>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddMenuOpen((open) => !open)}
            className="flex items-center gap-1 rounded border border-brand bg-brand px-2 py-1 text-xs font-semibold text-white hover:opacity-90"
            data-testid="add-effect-btn"
          >
            <Plus size={12} />
            添加效果
          </button>
          {addMenuOpen ? (
            <div className="absolute right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-line bg-white shadow-lg">
              {(Object.entries(EFFECT_LABELS) as [AudioEffectType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleAddEffect(type)}
                  className="block w-full whitespace-nowrap px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-panel"
                  data-testid={`add-effect-${type}`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {sortedEffects.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">点击"添加效果"开始</div>
        ) : (
          sortedEffects.map((effect, index) => (
            <EffectSlotCard
              key={effect.id}
              effect={effect}
              index={index}
              total={sortedEffects.length}
              onToggle={() => handleToggleEffect(effect.id)}
              onRemove={() => handleRemoveEffect(effect.id)}
              onParamChange={(param, value) => handleParamChange(effect.id, param, value)}
              onWetDryChange={(value) => handleWetDryChange(effect.id, value)}
              onMoveUp={() => handleMoveEffect(effect.id, 'up')}
              onMoveDown={() => handleMoveEffect(effect.id, 'down')}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Effect Slot Card ───────────────────────────────────────── */

function EffectSlotCard({
  effect,
  index,
  total,
  onToggle,
  onRemove,
  onParamChange,
  onWetDryChange,
  onMoveUp,
  onMoveDown,
}: {
  effect: AudioEffectSlot;
  index: number;
  total: number;
  onToggle(): void;
  onRemove(): void;
  onParamChange(param: string, value: number): void;
  onWetDryChange(value: number): void;
  onMoveUp(): void;
  onMoveDown(): void;
}) {
  const [expanded, setExpanded] = useState(true);
  const label = EFFECT_LABELS[effect.effectType] ?? effect.effectType;

  return (
    <div
      className={`rounded-md border bg-panel px-3 py-2 text-[11px] ${effect.enabled ? 'border-line' : 'border-slate-200 opacity-60'}`}
      data-testid={`effect-slot-${effect.effectType}`}
      data-effect-id={effect.id}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className={`h-3.5 w-3.5 flex-none rounded-full border ${effect.enabled ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'}`}
            aria-label={effect.enabled ? '禁用效果' : '启用效果'}
            data-testid={`toggle-effect-${effect.id}`}
          />
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-slate-700"
            data-testid={`expand-effect-${effect.id}`}
          >
            <span className="truncate">{label}</span>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>
        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
            aria-label="上移"
            data-testid={`move-up-effect-${effect.id}`}
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index >= total - 1}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
            aria-label="下移"
            data-testid={`move-down-effect-${effect.id}`}
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-slate-400 hover:text-red-500"
            aria-label="删除效果"
            data-testid={`remove-effect-${effect.id}`}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-2 space-y-1.5">
          {/* Wet/Dry */}
          <ParamSlider
            label="干湿比"
            value={effect.wetDry}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            disabled={!effect.enabled}
            testId={`wetdry-${effect.id}`}
            onChange={onWetDryChange}
          />

          {/* Parameters */}
          {Object.entries(effect.params).map(([param, value]) => {
            const range = PARAM_RANGES[param];
            if (!range) return null;
            const [min, max, step] = range;
            return (
              <ParamSlider
                key={param}
                label={PARAM_LABELS[param] ?? param}
                value={value}
                min={min}
                max={max}
                step={step}
                disabled={!effect.enabled}
                testId={`param-${effect.id}-${param}`}
                onChange={(v) => onParamChange(param, v)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Param Slider ───────────────────────────────────────────── */

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  disabled,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  disabled: boolean;
  testId: string;
  onChange(value: number): void;
}) {
  const display = format ? format(value) : value.toFixed(step < 1 ? 1 : 0);
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'text-slate-400' : 'text-slate-600'}`}>
      <span className="w-16 flex-none truncate text-[10px] font-medium">{label}</span>
      <input
        className="min-w-0 flex-1 accent-brand"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-10 flex-none text-right tabular-nums">{display}</span>
    </label>
  );
}

function ChevronRight({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
