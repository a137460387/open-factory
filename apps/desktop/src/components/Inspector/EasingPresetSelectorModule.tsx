import {useState} from 'react';
import {getEasingPresetsByCategory} from '@open-factory/editor-core';
import type {EasingPreset, EasingPresetCategory} from '@open-factory/editor-core';
import type {CurveEditorFrame} from './keyframeCurveHelpers';

export function EasingPresetSelector({
  selectedIds,
  frames,
  onApplyPreset,
}: {
  selectedIds: string[];
  frames: CurveEditorFrame[];
  onApplyPreset: (preset: EasingPreset) => void;
}) {
  const [expandedCategory, setExpandedCategory] = useState<EasingPresetCategory | null>(null);

  if (selectedIds.length === 0) return null;

  const categories: { key: EasingPresetCategory; label: string }[] = [
    { key: 'standard', label: '标准' },
    { key: 'overshoot', label: '过冲' },
    { key: 'spring', label: '弹簧' },
    { key: 'steps', label: '步进' },
  ];

  return (
    <div className="mt-1.5 space-y-1" data-testid="easing-preset-selector">
      <div className="text-[10px] text-[var(--color-text-muted)]">缓动预设</div>
      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setExpandedCategory(expandedCategory === cat.key ? null : cat.key)}
            className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
              expandedCategory === cat.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-accent text-muted-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      {expandedCategory && (
        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
          {getEasingPresetsByCategory(expandedCategory).map((preset) => (
            <button
              key={preset.id}
              onClick={() => onApplyPreset(preset)}
              className="px-1.5 py-0.5 text-[10px] rounded bg-muted hover:bg-accent transition-colors"
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
