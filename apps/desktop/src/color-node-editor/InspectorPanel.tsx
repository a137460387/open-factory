import {FolderOpen, Trash2} from 'lucide-react';
import {INPUT_COLOR_SPACES, normalizeInputColorSpace, type ColorNode, type ColorNodeBlendMode, type ColorNodeGraph, type ColorNodeType, type InputColorSpace} from '@open-factory/editor-core';
import {zhCN} from '../i18n/strings';
import {chooseLutFile} from './node-helpers';
import {clampNumber, formatNumber, resolveNodeLabel} from './utils';
import {BOARD_HEIGHT, BOARD_WIDTH} from './types';

const t = zhCN.colorNodeEditor;

interface PatchFn {
  (nodeId: string, patch: Partial<ColorNode>): void;
}

interface UpdateGraphFn {
  (recipe: (current: ColorNodeGraph) => ColorNodeGraph): void;
}

export function NodeInspector({
  selectedNode,
  graph,
  patchNode,
  setSelectedNodeId,
  updateGraph,
}: {
  selectedNode: ColorNode | undefined;
  graph: ColorNodeGraph;
  patchNode: PatchFn;
  setSelectedNodeId: (id: string) => void;
  updateGraph: UpdateGraphFn;
}) {
  return (
    <div className="space-y-4 p-4">
      {selectedNode ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.nodeInspector}</h3>
              <p className="text-xs text-slate-500">{selectedNode.id}</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                className="h-4 w-4 accent-brand"
                type="checkbox"
                checked={selectedNode.enabled !== false}
                onChange={(event) => patchNode(selectedNode.id, {enabled: event.target.checked})}
                data-testid="color-node-enabled-toggle"
              />
              {t.enabled}
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-600">
            {t.name}
            <input
              className="mt-1 h-9 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={selectedNode.name}
              onChange={(event) => patchNode(selectedNode.id, {name: event.target.value})}
              data-testid="color-node-name-input"
            />
          </label>

          <label className="block text-xs font-medium text-slate-600">
            {t.type}
            <select
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              value={selectedNode.type}
              onChange={(event) => patchNode(selectedNode.id, {type: event.target.value as ColorNodeType})}
              data-testid="color-node-type-select"
            >
              {(['input', 'sequential', 'parallel', 'layer', 'output', 'lut'] as ColorNodeType[]).map((type) => (
                <option key={type} value={type}>
                  {t.nodeTypes[type]}
                </option>
              ))}
            </select>
          </label>

          <InspectorCorrections selectedNode={selectedNode} patchNode={patchNode} />
          <InspectorBlend selectedNode={selectedNode} patchNode={patchNode} />
          <InspectorLut selectedNode={selectedNode} patchNode={patchNode} />
        </section>
      ) : (
        <div className="rounded-md border border-dashed border-line px-3 py-4 text-sm text-slate-500">
          {t.emptySelection}
        </div>
      )}

      <ConnectionsPanel graph={graph} setSelectedNodeId={setSelectedNodeId} updateGraph={updateGraph} />
    </div>
  );
}

function InspectorCorrections({
  selectedNode,
  patchNode,
}: {
  selectedNode: ColorNode;
  patchNode: PatchFn;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberInputField
          label={t.positionX}
          value={selectedNode.position.x}
          min={0}
          max={BOARD_WIDTH}
          step={1}
          onCommit={(value) => patchNode(selectedNode.id, {position: {...selectedNode.position, x: value}})}
          testId="color-node-position-x-input"
        />
        <NumberInputField
          label={t.positionY}
          value={selectedNode.position.y}
          min={0}
          max={BOARD_HEIGHT}
          step={1}
          onCommit={(value) => patchNode(selectedNode.id, {position: {...selectedNode.position, y: value}})}
          testId="color-node-position-y-input"
        />
      </div>

      {selectedNode.type !== 'output' && selectedNode.type !== 'input' ? (
        <div className="grid grid-cols-2 gap-3">
          <NumberInputField
            label={t.brightness}
            value={selectedNode.correction.brightness}
            min={-1}
            max={1}
            step={0.01}
            onCommit={(value) =>
              patchNode(selectedNode.id, {correction: {...selectedNode.correction, brightness: value}})
            }
            testId="color-node-brightness-input"
          />
          <NumberInputField
            label={t.contrast}
            value={selectedNode.correction.contrast}
            min={0}
            max={3}
            step={0.01}
            onCommit={(value) =>
              patchNode(selectedNode.id, {correction: {...selectedNode.correction, contrast: value}})
            }
            testId="color-node-contrast-input"
          />
          <NumberInputField
            label={t.saturation}
            value={selectedNode.correction.saturation}
            min={0}
            max={3}
            step={0.01}
            onCommit={(value) =>
              patchNode(selectedNode.id, {correction: {...selectedNode.correction, saturation: value}})
            }
            testId="color-node-saturation-input"
          />
          <NumberInputField
            label={t.hue}
            value={selectedNode.correction.hue}
            min={-180}
            max={180}
            step={1}
            onCommit={(value) => patchNode(selectedNode.id, {correction: {...selectedNode.correction, hue: value}})}
            testId="color-node-hue-input"
          />
        </div>
      ) : null}

      <label className="block text-xs font-medium text-slate-600">
        {t.inputColorSpace}
        <select
          className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={normalizeInputColorSpace(selectedNode.correction.inputColorSpace)}
          onChange={(event) =>
            patchNode(selectedNode.id, {
              correction: {
                ...selectedNode.correction,
                inputColorSpace: event.target.value as InputColorSpace,
              },
            })
          }
          data-testid="color-node-input-color-space-select"
        >
          {INPUT_COLOR_SPACES.map((colorSpace) => (
            <option key={colorSpace} value={colorSpace}>
              {zhCN.inspector.inputColorSpaces[colorSpace]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function InspectorBlend({
  selectedNode,
  patchNode,
}: {
  selectedNode: ColorNode;
  patchNode: PatchFn;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs font-medium text-slate-600">
        {t.blendMode}
        <select
          className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={selectedNode.blendMode ?? 'average'}
          onChange={(event) => patchNode(selectedNode.id, {blendMode: event.target.value as ColorNodeBlendMode})}
          data-testid="color-node-blend-mode-select"
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
      <NumberInputField
        label={t.mix}
        value={selectedNode.mix ?? 1}
        min={0}
        max={1}
        step={0.01}
        onCommit={(value) => patchNode(selectedNode.id, {mix: value})}
        testId="color-node-mix-input"
      />
    </div>
  );
}

function InspectorLut({
  selectedNode,
  patchNode,
}: {
  selectedNode: ColorNode;
  patchNode: PatchFn;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {t.lutPath}
      <div className="mt-1 flex items-center gap-2">
        <input
          className="h-9 min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm text-ink"
          value={selectedNode.lutPath ?? ''}
          placeholder={t.noLut}
          onChange={(event) =>
            patchNode(selectedNode.id, {
              lutPath: event.target.value || null,
              correction: {...selectedNode.correction, lutPath: event.target.value || null},
            })
          }
          data-testid="color-node-lut-path-input"
        />
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-slate-700 hover:bg-panel"
          type="button"
          title={t.chooseLut}
          aria-label={t.chooseLut}
          data-testid="color-node-choose-lut-button"
          onClick={() =>
            void chooseLutFile((path) =>
              patchNode(selectedNode.id, {
                lutPath: path,
                correction: {...selectedNode.correction, lutPath: path},
              }),
            )
          }
        >
          <FolderOpen size={14} />
        </button>
      </div>
    </label>
  );
}

export function ConnectionsPanel({
  graph,
  setSelectedNodeId,
  updateGraph,
}: {
  graph: ColorNodeGraph;
  setSelectedNodeId: (id: string) => void;
  updateGraph: UpdateGraphFn;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-ink">{t.connections}</h3>
      <div className="space-y-2">
        {graph.connections.length > 0 ? (
          graph.connections.map((connection) => (
            <div
              key={connection.id}
              className="flex items-center justify-between gap-2 rounded-md border border-line bg-panel px-3 py-2 text-xs"
              data-testid="color-node-connection-row"
            >
              <button
                className="min-w-0 flex-1 text-left"
                type="button"
                onClick={() => setSelectedNodeId(connection.from)}
                title={connection.from}
              >
                <span className="block truncate font-medium text-ink">
                  {resolveNodeLabel(graph, connection.from)}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {resolveNodeLabel(graph, connection.to)}
                </span>
              </button>
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                type="button"
                title={zhCN.common.delete}
                aria-label={zhCN.common.delete}
                onClick={() =>
                  updateGraph((current) => ({
                    ...current,
                    connections: current.connections.filter((item) => item.id !== connection.id),
                  }))
                }
                data-testid={`color-node-delete-connection-${connection.id}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-line px-3 py-4 text-sm text-slate-500">
            {t.noConnections}
          </div>
        )}
      </div>
    </section>
  );
}

function NumberInputField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit(value: number): void;
  testId?: string;
}) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="tabular-nums">{formatNumber(value)}</span>
      </span>
      <input
        className="h-9 w-full rounded-md border border-line px-2 text-right tabular-nums text-sm text-ink"
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
