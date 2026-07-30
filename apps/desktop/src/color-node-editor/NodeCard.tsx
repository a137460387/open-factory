import {ChevronDown, FolderOpen, Move} from 'lucide-react';
import type {ColorNodeBlendMode, ColorNodeType} from '@open-factory/editor-core';
import {zhCN} from '../i18n/strings';
import type {NodeCardProps} from './types';
import {BOARD_HEIGHT, BOARD_WIDTH, NODE_HEIGHT, NODE_WIDTH} from './types';
import {chooseLutFile} from './node-helpers';
import {NumberInput} from './NumberInput';

const t = zhCN.colorNodeEditor;

export function NodeCard({
  node,
  selected,
  onSelect,
  onPatch,
  onBeginDrag,
  onBeginConnection,
  onEndConnection,
}: NodeCardProps) {
  return (
    <div
      className={`absolute rounded-md border shadow-soft ${selected ? 'border-brand bg-white ring-2 ring-brand/30' : 'border-white/10 bg-white/95'}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
      }}
      onMouseDown={onSelect}
      data-testid={`color-node-card-${node.id}`}
      data-node-id={node.id}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel text-slate-600 hover:bg-white"
          type="button"
          title={t.dragNode}
          aria-label={t.dragNode}
          onPointerDown={onBeginDrag}
          data-testid={`color-node-drag-${node.id}`}
        >
          <Move size={13} />
        </button>
        <button
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink"
          type="button"
          onClick={onSelect}
          data-testid={`color-node-select-${node.id}`}
        >
          {node.name}
        </button>
        <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <input
            className="h-3.5 w-3.5 accent-brand"
            type="checkbox"
            checked={node.enabled !== false}
            onChange={(event) => onPatch({enabled: event.target.checked})}
            data-testid={`color-node-enabled-${node.id}`}
          />
          {t.enabled}
        </label>
      </div>
      <div className="space-y-2 px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded border border-line px-2 py-1 text-[11px] font-medium text-slate-600">
            {t.nodeTypes[node.type]}
          </span>
          <select
            className="h-7 rounded-md border border-line bg-white px-2 text-[11px] font-medium text-slate-700"
            value={node.type}
            onChange={(event) => onPatch({type: event.target.value as ColorNodeType})}
            data-testid={`color-node-type-${node.id}`}
          >
            {(['input', 'sequential', 'parallel', 'layer', 'output', 'lut'] as ColorNodeType[]).map((type) => (
              <option key={type} value={type}>
                {t.nodeTypes[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label={t.positionX}
            value={node.position.x}
            min={0}
            max={BOARD_WIDTH}
            step={1}
            onCommit={(value) => onPatch({position: {...node.position, x: value}})}
            testId={`color-node-position-x-${node.id}`}
            compact
          />
          <NumberInput
            label={t.positionY}
            value={node.position.y}
            min={0}
            max={BOARD_HEIGHT}
            step={1}
            onCommit={(value) => onPatch({position: {...node.position, y: value}})}
            testId={`color-node-position-y-${node.id}`}
            compact
          />
        </div>
        {node.type !== 'input' && node.type !== 'output' ? (
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label={t.brightness}
              value={node.correction.brightness}
              min={-1}
              max={1}
              step={0.01}
              onCommit={(value) => onPatch({correction: {...node.correction, brightness: value}})}
              testId={`color-node-brightness-${node.id}`}
              compact
            />
            <NumberInput
              label={t.contrast}
              value={node.correction.contrast}
              min={0}
              max={3}
              step={0.01}
              onCommit={(value) => onPatch({correction: {...node.correction, contrast: value}})}
              testId={`color-node-contrast-${node.id}`}
              compact
            />
            <NumberInput
              label={t.saturation}
              value={node.correction.saturation}
              min={0}
              max={3}
              step={0.01}
              onCommit={(value) => onPatch({correction: {...node.correction, saturation: value}})}
              testId={`color-node-saturation-${node.id}`}
              compact
            />
            <NumberInput
              label={t.hue}
              value={node.correction.hue}
              min={-180}
              max={180}
              step={1}
              onCommit={(value) => onPatch({correction: {...node.correction, hue: value}})}
              testId={`color-node-hue-${node.id}`}
              compact
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">{t.blendMode}</span>
            <select
              className="h-7 w-full rounded-md border border-line bg-white px-2 text-[11px] font-medium text-slate-700"
              value={node.blendMode ?? 'average'}
              onChange={(event) => onPatch({blendMode: event.target.value as ColorNodeBlendMode})}
              data-testid={`color-node-blend-${node.id}`}
            >
              {(['average', 'normal', 'multiply', 'screen', 'overlay', 'addition'] as ColorNodeBlendMode[]).map(
                (mode) => (
                  <option key={mode} value={mode}>
                    {t.blendModes[mode]}
                  </option>
                ),
              )}
            </select>
          </label>
          <NumberInput
            label={t.mix}
            value={node.mix ?? 1}
            min={0}
            max={1}
            step={0.01}
            onCommit={(value) => onPatch({mix: value})}
            testId={`color-node-mix-${node.id}`}
            compact
          />
        </div>
        {node.type === 'lut' ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">{t.lutPath}</span>
            <div className="flex items-center gap-1">
              <input
                className="h-7 min-w-0 flex-1 rounded-md border border-line px-2 text-[11px] text-ink"
                value={node.lutPath ?? ''}
                placeholder={t.noLut}
                onChange={(event) =>
                  onPatch({
                    lutPath: event.target.value || null,
                    correction: {...node.correction, lutPath: event.target.value || null},
                  })
                }
                data-testid={`color-node-lut-path-${node.id}`}
              />
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                type="button"
                title={t.chooseLut}
                aria-label={t.chooseLut}
                onClick={() =>
                  void chooseLutFile((path) =>
                    onPatch({lutPath: path, correction: {...node.correction, lutPath: path}}),
                  )
                }
                data-testid={`color-node-choose-lut-${node.id}`}
              >
                <FolderOpen size={12} />
              </button>
            </div>
          </label>
        ) : null}
      </div>
      {node.type !== 'output' ? (
        <button
          className="absolute right-[-8px] top-1/2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300 bg-amber-300 text-[10px] text-amber-950 shadow-sm"
          type="button"
          title={t.connectionFrom}
          aria-label={t.connectionFrom}
          onPointerDown={onBeginConnection}
          data-testid={`color-node-output-port-${node.id}`}
        >
          <ChevronDown size={10} className="-rotate-90" />
        </button>
      ) : null}
      {node.type !== 'input' ? (
        <button
          className="absolute left-[-8px] top-1/2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-sky-300 bg-sky-300 text-[10px] text-sky-950 shadow-sm"
          type="button"
          title={t.connectionTo}
          aria-label={t.connectionTo}
          onPointerUp={onEndConnection}
          data-testid={`color-node-input-port-${node.id}`}
        >
          <ChevronDown size={10} className="rotate-90" />
        </button>
      ) : null}
    </div>
  );
}
