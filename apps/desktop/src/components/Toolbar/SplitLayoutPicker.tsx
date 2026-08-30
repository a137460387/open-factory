import { BUILT_IN_SPLIT_LAYOUTS, SPLIT_LAYOUT_PRESET_IDS, type SplitLayoutDefinition } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export function SplitLayoutPicker({
  customLayouts,
  customRatio,
  onCustomRatioChange,
  onApply,
  onSaveCustom,
}: {
  customLayouts: SplitLayoutDefinition[];
  customRatio: number;
  onCustomRatioChange(value: number): void;
  onApply(layoutId: string): void;
  onSaveCustom(): Promise<void>;
}) {
  const t = zhCN.toolbar;
  const layouts = [...SPLIT_LAYOUT_PRESET_IDS.map((id) => BUILT_IN_SPLIT_LAYOUTS[id]), ...customLayouts];
  return (
    <div
      className="absolute left-0 top-10 z-30 w-80 rounded-md border border-line bg-white p-3 text-xs shadow-soft"
      data-testid="split-layout-picker"
    >
      <div className="mb-2 font-semibold text-slate-700">{t.applySplitLayout}</div>
      <div className="grid grid-cols-2 gap-2">
        {layouts.map((layout) => (
          <button
            key={layout.id}
            className="rounded-md border border-line bg-panel p-2 text-left hover:border-brand hover:bg-white"
            type="button"
            data-testid={`split-layout-option-${layout.id}`}
            onClick={() => onApply(layout.id)}
          >
            <SplitLayoutPreview layout={layout} />
            <div className="mt-1 truncate font-medium text-slate-700">
              {t.splitLayouts[layout.id as keyof typeof t.splitLayouts] ?? layout.name}
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-md border border-line bg-panel p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-medium text-slate-700">{t.customSplitLayout}</span>
          <span className="tabular-nums text-slate-500">{Math.round(customRatio * 100)}%</span>
        </div>
        <input
          className="w-full"
          type="range"
          min={20}
          max={80}
          step={1}
          value={Math.round(customRatio * 100)}
          data-testid="split-layout-custom-ratio-input"
          onChange={(event) => onCustomRatioChange(Number(event.target.value) / 100)}
        />
        <button
          className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-line bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-panel"
          type="button"
          data-testid="split-layout-save-custom"
          onClick={() => void onSaveCustom()}
        >
          {t.saveCustomSplitLayout}
        </button>
      </div>
    </div>
  );
}

function SplitLayoutPreview({ layout }: { layout: SplitLayoutDefinition }) {
  return (
    <svg className="h-16 w-full rounded border border-line bg-black" viewBox="0 0 120 68" role="img" aria-hidden="true">
      {layout.cells.map((cell, index) => (
        <rect
          key={`${cell.x}-${cell.y}-${cell.width}-${cell.height}-${index}`}
          x={cell.x * 120 + 1}
          y={cell.y * 68 + 1}
          width={Math.max(1, cell.width * 120 - 2)}
          height={Math.max(1, cell.height * 68 - 2)}
          fill={index % 2 === 0 ? '#2dd4bf' : '#60a5fa'}
          opacity={0.9}
        />
      ))}
    </svg>
  );
}
