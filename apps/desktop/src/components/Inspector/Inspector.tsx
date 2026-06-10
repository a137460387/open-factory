import type { Clip, MediaAsset } from '@open-factory/editor-core';
import {
  AddKeyframeCommand,
  DEFAULT_COLOR_CORRECTION,
  KEYFRAME_PROPERTY_LIMITS,
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
  RemoveKeyframeCommand,
  UpdateKeyframeCommand,
  UpdateClipCommand,
  createKenBurnsKeyframes,
  getClipSpeed,
  getClipKeyframeValue,
  normalizeColorCorrection,
  setKenBurnsEndScaleKeyframes,
  type ClipPatch,
  type KeyframeEasing,
  type KeyframeProperty
} from '@open-factory/editor-core';
import { Palette, SlidersHorizontal, X } from 'lucide-react';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { openFileDialog } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';
import type { SelectedKeyframeRef } from '../../store/editorStore';

interface InspectorProps {
  clip?: Clip;
  selectedCount: number;
  selectedClipLocked: boolean;
  selectedKeyframe?: SelectedKeyframeRef;
  media: MediaAsset[];
  playheadTime: number;
}

export function Inspector({ clip, selectedCount, selectedClipLocked, selectedKeyframe, media, playheadTime }: InspectorProps) {
  if (!clip && selectedCount > 1) {
    return (
      <aside className="flex min-h-0 flex-col bg-white">
        <PanelTitle />
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">多个 clip 已选中（{selectedCount}）</div>
      </aside>
    );
  }

  if (!clip) {
    return (
      <aside className="flex min-h-0 flex-col bg-white">
        <PanelTitle />
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">Select a clip to edit its properties.</div>
      </aside>
    );
  }

  const asset = 'mediaId' in clip ? media.find((item) => item.id === clip.mediaId) : undefined;
  const commit = (patch: ClipPatch) => {
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, patch));
    } catch (error) {
      showToast({ kind: 'warning', title: 'Property rejected', message: error instanceof Error ? error.message : 'Unable to update clip.' });
    }
  };
  const chooseLut = async () => {
    try {
      const paths = await openFileDialog(false, [{ name: 'Cube LUT', extensions: ['cube'] }]);
      const lutPath = paths[0];
      if (lutPath) {
        commit({ colorCorrection: { lutPath } });
      }
    } catch (error) {
      showToast({ kind: 'warning', title: 'LUT unavailable', message: error instanceof Error ? error.message : 'Unable to choose a LUT file.' });
    }
  };
  const localKeyframeTime = Math.min(clip.duration, Math.max(0, playheadTime - clip.start));
  const addKeyframe = (property: KeyframeProperty, value = getClipKeyframeValue(clip, property, localKeyframeTime)) => {
    try {
      commandManager.execute(new AddKeyframeCommand(timelineAccessor, clip.id, property, { time: localKeyframeTime, value }));
    } catch (error) {
      showToast({ kind: 'warning', title: 'Keyframe rejected', message: error instanceof Error ? error.message : 'Unable to add keyframe.' });
    }
  };
  const setKenBurns = (enabled: boolean) => {
    if (clip.type !== 'image') {
      return;
    }
    if (!enabled) {
      commit({ kenBurns: false });
      return;
    }
    commit({
      kenBurns: true,
      keyframes: {
        ...clip.keyframes,
        ...createKenBurnsKeyframes(clip.duration, clip.transform.scale, Math.max(clip.transform.scale + 0.5, 1.5))
      }
    });
  };
  const updateKenBurnsEndScale = (scale: number) => {
    if (clip.type !== 'image') {
      return;
    }
    commit({ keyframes: setKenBurnsEndScaleKeyframes(clip.keyframes, clip.duration, scale) });
  };
  const selectedKeyframeFrame =
    selectedKeyframe?.clipId === clip.id ? clip.keyframes?.[selectedKeyframe.property]?.find((frame) => frame.id === selectedKeyframe.keyframeId) : undefined;
  const updateSelectedKeyframe = (patch: Partial<Pick<NonNullable<typeof selectedKeyframeFrame>, 'time' | 'value' | 'easing'>>) => {
    if (!selectedKeyframe) {
      return;
    }
    try {
      commandManager.execute(new UpdateKeyframeCommand(timelineAccessor, clip.id, selectedKeyframe.property, selectedKeyframe.keyframeId, patch));
    } catch (error) {
      showToast({ kind: 'warning', title: 'Keyframe rejected', message: error instanceof Error ? error.message : 'Unable to update keyframe.' });
    }
  };
  const removeSelectedKeyframe = () => {
    if (!selectedKeyframe) {
      return;
    }
    try {
      commandManager.execute(new RemoveKeyframeCommand(timelineAccessor, clip.id, selectedKeyframe.property, selectedKeyframe.keyframeId));
    } catch (error) {
      showToast({ kind: 'warning', title: 'Keyframe rejected', message: error instanceof Error ? error.message : 'Unable to remove keyframe.' });
    }
  };

  return (
    <aside className="flex min-h-0 flex-col bg-white">
      <PanelTitle />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <Section title="Clip">
          {selectedClipLocked ? <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">已锁定</div> : null}
          <TextField label="Name" value={clip.name} onCommit={(name) => commit({ name })} />
          <NumberField label="Start" value={clip.start} min={0} step={0.033} onCommit={(start) => commit({ start })} />
          <NumberField label="Duration" value={clip.duration} min={0.033} step={0.033} onCommit={(duration) => commit({ duration })} />
          {asset ? (
            <div className="rounded-md bg-panel p-2 text-xs text-slate-600">
              <div className="truncate font-medium text-slate-700">{asset.name}</div>
              <div>{asset.missing ? 'Missing file' : `${asset.width || '-'} x ${asset.height || '-'} | ${asset.duration.toFixed(2)}s`}</div>
            </div>
          ) : null}
        </Section>

        {clip.type === 'video' || clip.type === 'audio' ? (
          <Section title="Speed">
            <div className="rounded-md bg-panel p-2 text-xs text-slate-600">
              速度 {getClipSpeed(clip).toFixed(2)}x / 时长 {clip.duration.toFixed(2)}s
            </div>
            <RangeNumberField
              label="Speed"
              value={getClipSpeed(clip)}
              min={MIN_CLIP_SPEED}
              max={MAX_CLIP_SPEED}
              step={0.05}
              format={(value) => `${value.toFixed(2)}x`}
              onCommit={(speed) => commit({ speed })}
            />
          </Section>
        ) : null}

        <Section title="Transform">
          <AnimatedField label="X" onAddKeyframe={() => addKeyframe('x')}>
            <NumberField label="X" value={clip.transform.x} step={1} onCommit={(x) => commit({ transform: { x } })} hideLabel />
          </AnimatedField>
          <AnimatedField label="Y" onAddKeyframe={() => addKeyframe('y')}>
            <NumberField label="Y" value={clip.transform.y} step={1} onCommit={(y) => commit({ transform: { y } })} hideLabel />
          </AnimatedField>
          <AnimatedField label="Scale" onAddKeyframe={() => {
            addKeyframe('scaleX', clip.transform.scale);
            addKeyframe('scaleY', clip.transform.scale);
          }}>
            <RangeField label="Scale" value={clip.transform.scale} min={0.1} max={4} step={0.05} format={(value) => `${Math.round(value * 100)}%`} onCommit={(scale) => commit({ transform: { scale } })} hideLabel />
          </AnimatedField>
          <NumberField label="Rotation" value={clip.transform.rotation} step={1} onCommit={(rotation) => commit({ transform: { rotation } })} />
          {clip.type !== 'audio' ? (
            <AnimatedField label="Opacity" onAddKeyframe={() => addKeyframe('opacity')} testId="add-opacity-keyframe-button">
              <RangeField
                label="Opacity"
                value={clip.transform.opacity}
                min={0}
                max={1}
                step={0.01}
                format={(value) => `${Math.round(value * 100)}%`}
                onCommit={(opacity) => commit({ transform: { opacity } })}
                hideLabel
                testId="clip-opacity-slider"
              />
            </AnimatedField>
          ) : null}
        </Section>

        {selectedKeyframe && selectedKeyframeFrame ? (
          <Section title="Keyframe">
            <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600" data-testid="selected-keyframe-editor">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">{formatKeyframeProperty(selectedKeyframe.property)}</span>
                <span className="tabular-nums">{selectedKeyframeFrame.time.toFixed(2)}s</span>
              </div>
              <RangeNumberField
                label="Time"
                value={selectedKeyframeFrame.time}
                min={0}
                max={clip.duration}
                step={0.01}
                format={(value) => `${value.toFixed(2)}s`}
                onCommit={(time) => updateSelectedKeyframe({ time })}
              />
              <RangeNumberField
                label="Value"
                value={selectedKeyframeFrame.value}
                min={KEYFRAME_PROPERTY_LIMITS[selectedKeyframe.property].min}
                max={KEYFRAME_PROPERTY_LIMITS[selectedKeyframe.property].max}
                step={0.01}
                format={(value) => formatKeyframeValue(selectedKeyframe.property, value)}
                onCommit={(value) => updateSelectedKeyframe({ value })}
              />
              <label className="mt-2 block text-xs font-medium text-slate-600">
                Easing
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={selectedKeyframeFrame.easing}
                  data-testid="selected-keyframe-easing"
                  onChange={(event) => updateSelectedKeyframe({ easing: event.target.value as KeyframeEasing })}
                >
                  <option value="linear">Linear</option>
                  <option value="ease-in">Ease in</option>
                  <option value="ease-out">Ease out</option>
                  <option value="ease-in-out">Ease in-out</option>
                </select>
              </label>
              <button
                className="mt-2 w-full rounded-md border border-rose-300 px-2 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                type="button"
                data-testid="remove-selected-keyframe-button"
                onClick={removeSelectedKeyframe}
              >
                Remove keyframe
              </button>
            </div>
          </Section>
        ) : null}

        {clip.type === 'image' ? (
          <Section title="Ken Burns">
            <ToggleField label="Ken Burns" checked={Boolean(clip.kenBurns)} onCommit={setKenBurns} testId="ken-burns-toggle" />
            {clip.kenBurns ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600">
                  <div className="mb-1 font-semibold">Start</div>
                  <div>{Math.round((clip.keyframes?.scaleX?.[0]?.value ?? clip.transform.scale) * 100)}%</div>
                </div>
                <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600">
                  <div className="mb-1 font-semibold">End</div>
                  <RangeNumberField
                    label="End scale"
                    value={getKenBurnsEndScale(clip)}
                    min={0.1}
                    max={4}
                    step={0.05}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onCommit={updateKenBurnsEndScale}
                  />
                </div>
              </div>
            ) : null}
          </Section>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4" open>
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-slate-500">Color correction</summary>
            <div className="space-y-3">
              <RangeNumberField
                label="Brightness"
                value={normalizeColorCorrection(clip.colorCorrection).brightness}
                min={-1}
                max={1}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onCommit={(brightness) => commit({ colorCorrection: { brightness } })}
              />
              <RangeNumberField
                label="Contrast"
                value={normalizeColorCorrection(clip.colorCorrection).contrast}
                min={0}
                max={2}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onCommit={(contrast) => commit({ colorCorrection: { contrast } })}
              />
              <RangeNumberField
                label="Saturation"
                value={normalizeColorCorrection(clip.colorCorrection).saturation}
                min={0}
                max={2}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onCommit={(saturation) => commit({ colorCorrection: { saturation } })}
              />
              <RangeNumberField
                label="Hue"
                value={normalizeColorCorrection(clip.colorCorrection).hue}
                min={-180}
                max={180}
                step={1}
                format={(value) => `${Math.round(value)}°`}
                onCommit={(hue) => commit({ colorCorrection: { hue } })}
              />
              <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600" data-testid="clip-lut-control">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">LUT</span>
                  {normalizeColorCorrection(clip.colorCorrection).lutPath ? (
                    <button
                      className="rounded border border-line bg-white p-1 hover:bg-white"
                      type="button"
                      title="Clear LUT"
                      data-testid="clear-lut-button"
                      onClick={() => commit({ colorCorrection: { lutPath: null } })}
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
                <div className="mb-2 truncate" title={normalizeColorCorrection(clip.colorCorrection).lutPath ?? undefined} data-testid="clip-lut-path">
                  {formatLutPath(normalizeColorCorrection(clip.colorCorrection).lutPath)}
                </div>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-white"
                  type="button"
                  data-testid="choose-lut-button"
                  onClick={() => void chooseLut()}
                >
                  <Palette size={14} />
                  Load .cube LUT
                </button>
              </div>
              <button
                className="w-full rounded-md border border-line px-2 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                onClick={() => commit({ colorCorrection: { ...DEFAULT_COLOR_CORRECTION } })}
              >
                Reset
              </button>
            </div>
          </details>
        ) : null}

        {'volume' in clip ? (
          <Section title="Audio">
            <AnimatedField label="Volume" onAddKeyframe={() => addKeyframe('volume')} testId="add-volume-keyframe-button">
              <RangeField label="Volume" value={clip.volume} min={0} max={2} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onCommit={(volume) => commit({ volume })} hideLabel />
            </AnimatedField>
          </Section>
        ) : null}

        {clip.type === 'text' || clip.type === 'subtitle' ? (
          <Section title={clip.type === 'subtitle' ? 'Subtitle' : 'Text'}>
            <TextAreaField label="Text" value={clip.text} onCommit={(text) => commit({ text })} />
            <NumberField label="Font size" value={clip.style.fontSize} min={8} step={1} onCommit={(fontSize) => commit({ style: { fontSize } })} />
            <TextField label="Font family" value={clip.style.fontFamily} onCommit={(fontFamily) => commit({ style: { fontFamily } })} />
            <ColorField label="Color" value={clip.style.color} onCommit={(color) => commit({ style: { color } })} />
            <ColorField label="Background" value={clip.style.backgroundColor} onCommit={(backgroundColor) => commit({ style: { backgroundColor } })} />
            <RangeField
              label="Background opacity"
              value={clip.style.backgroundOpacity}
              min={0}
              max={1}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onCommit={(backgroundOpacity) => commit({ style: { backgroundOpacity } })}
            />
            {clip.type === 'subtitle' ? (
              <>
                <NumberField label="Bottom margin" value={clip.style.yOffset} min={0} step={1} onCommit={(yOffset) => commit({ style: { yOffset } })} />
                <label className="block text-xs font-medium text-slate-600">
                  Export mode
                  <select
                    className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
                    value={clip.subtitleMode}
                    data-testid="subtitle-mode-select"
                    onChange={(event) => commit({ subtitleMode: event.target.value === 'soft-sub' ? 'soft-sub' : 'burn-in' })}
                  >
                    <option value="burn-in">Burn-in</option>
                    <option value="soft-sub">Soft subtitles</option>
                  </select>
                </label>
              </>
            ) : null}
            <ToggleField label="Bold" checked={clip.style.bold} onCommit={(bold) => commit({ style: { bold } })} />
            <ToggleField label="Italic" checked={clip.style.italic} onCommit={(italic) => commit({ style: { italic } })} />
          </Section>
        ) : null}
      </div>
    </aside>
  );
}

function PanelTitle() {
  return (
    <div className="flex items-center gap-2 border-b border-line px-3 py-2">
      <SlidersHorizontal size={16} />
      <div>
        <div className="text-sm font-semibold">Inspector</div>
        <div className="text-xs text-slate-500">Clip properties</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function TextField({ label, value, onCommit }: { label: string; value: string; onCommit(value: string): void }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink" defaultValue={value} onBlur={(event) => onCommit(event.target.value)} />
    </label>
  );
}

function TextAreaField({ label, value, onCommit }: { label: string; value: string; onCommit(value: string): void }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <textarea className="mt-1 min-h-20 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink" defaultValue={value} onBlur={(event) => onCommit(event.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  step,
  onCommit,
  hideLabel = false
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onCommit(value: number): void;
  hideLabel?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {hideLabel ? <span className="sr-only">{label}</span> : label}
      <input
        className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
        type="number"
        defaultValue={Number(value.toFixed(3))}
        min={min}
        step={step ?? 1}
        onBlur={(event) => onCommit(Number(event.target.value))}
      />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
  hideLabel = false,
  testId
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
    <label className="block text-xs font-medium text-slate-600">
      <span className="flex justify-between">
        <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </span>
      <input className="mt-1 w-full accent-brand" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onCommit(Number(event.target.value))} data-testid={testId} />
    </label>
  );
}

function RangeNumberField({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format(value: number): string;
  onCommit(value: number): void;
}) {
  const commitClamped = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) {
      return;
    }
    onCommit(Math.min(max, Math.max(min, nextValue)));
  };
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <input
          className="w-20 rounded-md border border-line px-2 py-1 text-right text-xs tabular-nums text-ink"
          type="number"
          value={Number(value.toFixed(3))}
          min={min}
          max={max}
          step={step}
          onChange={(event) => commitClamped(Number(event.target.value))}
          aria-label={label}
        />
      </span>
      <span className="mt-1 flex items-center gap-2">
        <input className="min-w-0 flex-1 accent-brand" type="range" min={min} max={max} step={step} value={value} onChange={(event) => commitClamped(Number(event.target.value))} />
        <span className="w-14 text-right text-xs tabular-nums text-slate-500">{format(value)}</span>
      </span>
    </label>
  );
}

function ColorField({ label, value, onCommit }: { label: string; value: string; onCommit(value: string): void }) {
  return (
    <label className="flex items-center justify-between text-xs font-medium text-slate-600">
      {label}
      <input className="h-8 w-12 rounded border border-line" type="color" value={value} onChange={(event) => onCommit(event.target.value)} />
    </label>
  );
}

function ToggleField({ label, checked, onCommit, testId }: { label: string; checked: boolean; onCommit(value: boolean): void; testId?: string }) {
  return (
    <label className="flex items-center justify-between text-xs font-medium text-slate-600">
      {label}
      <input className="h-4 w-4 accent-brand" type="checkbox" checked={checked} onChange={(event) => onCommit(event.target.checked)} data-testid={testId} />
    </label>
  );
}

function formatLutPath(path: string | null | undefined): string {
  if (!path) {
    return 'No LUT loaded';
  }
  return path.split(/[\\/]/).at(-1) ?? path;
}

function AnimatedField({ label, children, onAddKeyframe, testId }: { label: string; children: React.ReactNode; onAddKeyframe(): void; testId?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
      <div>
        <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
        {children}
      </div>
      <button
        className="mb-0.5 h-8 w-8 rounded-md border border-line bg-white text-xs font-semibold text-brand hover:bg-panel"
        type="button"
        title={`Add ${label} keyframe`}
        data-testid={testId ?? `add-${label.toLowerCase()}-keyframe-button`}
        onClick={onAddKeyframe}
      >
        ◆
      </button>
    </div>
  );
}

function getKenBurnsEndScale(clip: Extract<Clip, { type: 'image' }>): number {
  return clip.keyframes?.scaleX?.at(-1)?.value ?? clip.transform.scale;
}

function formatKeyframeProperty(property: KeyframeProperty): string {
  if (property === 'scaleX') {
    return 'Scale X';
  }
  if (property === 'scaleY') {
    return 'Scale Y';
  }
  return property[0].toUpperCase() + property.slice(1);
}

function formatKeyframeValue(property: KeyframeProperty, value: number): string {
  if (property === 'opacity' || property === 'volume' || property === 'scaleX' || property === 'scaleY') {
    return `${Math.round(value * 100)}%`;
  }
  return value.toFixed(2);
}
