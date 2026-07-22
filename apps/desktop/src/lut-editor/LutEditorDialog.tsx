import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  buildLutCreatorMatrix,
  buildLutCreatorReferenceTransform,
  createDefaultColorCurves,
  createDefaultLutCreatorState,
  DEFAULT_THREE_WAY_COLOR,
  normalizeColorCurves,
  normalizeColorWheelValue,
  normalizeCurvePoints,
  normalizeThreeWayColor,
  sampleCurve,
  serializeLutCreatorCube,
  type ColorCurves,
  type ColorWheelValue,
  type CurvePoint,
  type LutCreatorPrecision,
  type LutCreatorState,
  type ThreeWayColor,
} from '@open-factory/editor-core';
import { clamp, clamp01 } from '@open-factory/editor-core/utils/math';
import { zhCN } from '../i18n/strings';
import {
  getAppDataDir,
  openFileDialog,
  readColorMatchFrameSample,
  saveFileDialog,
  writeFile,
} from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';

interface LutEditorDialogProps {
  onClose(): void;
}

type CurveChannel = keyof ColorCurves;
type ThreeWayKey = keyof ThreeWayColor;

const CURVE_CHANNELS: Array<{ key: CurveChannel; label: string; color: string }> = [
  { key: 'master', label: zhCN.inspector.fields.masterCurve, color: '#f8fafc' },
  { key: 'r', label: zhCN.inspector.fields.redCurve, color: '#ef4444' },
  { key: 'g', label: zhCN.inspector.fields.greenCurve, color: '#22c55e' },
  { key: 'b', label: zhCN.inspector.fields.blueCurve, color: '#3b82f6' },
];

const THREE_WAY_CHANNELS: Array<{ key: ThreeWayKey; label: string }> = [
  { key: 'lift', label: zhCN.inspector.fields.lift },
  { key: 'gamma', label: zhCN.inspector.fields.gamma },
  { key: 'gain', label: zhCN.inspector.fields.gain },
];

export function LutEditorDialog({ onClose }: LutEditorDialogProps) {
  const t = zhCN.lutEditor;
  const [state, setState] = useState<LutCreatorState>(() => createDefaultLutCreatorState());
  const [busy, setBusy] = useState(false);
  const matrix = useMemo(() => buildLutCreatorMatrix(state), [state]);

  const updateState = (patch: Partial<LutCreatorState>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  async function loadReferenceImage() {
    try {
      setBusy(true);
      const [path] = await openFileDialog(false, [
        { name: t.referenceImageFilter, extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      ]);
      if (!path) {
        return;
      }
      const sample = await readColorMatchFrameSample(path);
      const transform = buildLutCreatorReferenceTransform(sample);
      if (!transform) {
        throw new Error(t.referenceFailedMessage);
      }
      updateState({ referenceTransform: transform, referenceName: fileNameFromPath(path) });
      showToast({ kind: 'success', title: t.referenceLoaded, message: fileNameFromPath(path) });
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.referenceFailed,
        message: error instanceof Error ? error.message : t.referenceFailedMessage,
      });
    } finally {
      setBusy(false);
    }
  }

  async function exportCube() {
    try {
      setBusy(true);
      const appDataDir = await getAppDataDir();
      const defaultPath = `${appDataDir.replace(/[\\/]+$/, '')}/luts/${sanitizeFileBaseName(state.title)}.cube`;
      const path = await saveFileDialog(defaultPath, [{ name: t.cubeFilter, extensions: ['cube'] }]);
      if (!path) {
        return;
      }
      await writeFile(path, serializeLutCreatorCube(state));
      showToast({ kind: 'success', title: t.exportedTitle, message: path });
      onClose();
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.exportFailed,
        message: error instanceof Error ? error.message : t.exportFailedMessage,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="lut-editor-dialog"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <h2 className="text-base font-semibold text-ink">{t.title}</h2>
          <p className="text-sm text-slate-500">{t.description}</p>
        </div>
        <div className="grid min-h-0 flex-1 gap-px overflow-hidden bg-line md:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-h-0 space-y-4 overflow-y-auto bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-600">
                {t.name}
                <input
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
                  value={state.title}
                  onChange={(event) => updateState({ title: event.target.value })}
                  data-testid="lut-editor-name-input"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t.precision}
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={state.precision}
                  onChange={(event) => updateState({ precision: Number(event.target.value) as LutCreatorPrecision })}
                  data-testid="lut-editor-precision-select"
                >
                  <option value={17}>{t.precisions[17]}</option>
                  <option value={33}>{t.precisions[33]}</option>
                  <option value={65}>{t.precisions[65]}</option>
                </select>
              </label>
            </div>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">{t.threeWay}</h3>
              <ThreeWayColorEditor
                threeWayColor={state.threeWayColor}
                onCommit={(threeWayColor) => updateState({ threeWayColor })}
              />
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">{t.curves}</h3>
              <CurveEditor curves={state.colorCurves} onCommit={(colorCurves) => updateState({ colorCurves })} />
            </section>
            <section className="rounded-md border border-line bg-panel p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{t.colorMatch}</h3>
                  <p className="text-xs text-slate-500">
                    {state.referenceName ? t.referenceCurrent(state.referenceName) : t.referenceEmpty}
                  </p>
                </div>
                <button
                  className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-panel disabled:opacity-50"
                  type="button"
                  onClick={() => void loadReferenceImage()}
                  disabled={busy}
                  data-testid="lut-editor-reference-button"
                >
                  {t.loadReference}
                </button>
              </div>
            </section>
          </div>
          <aside className="min-h-0 overflow-y-auto bg-panel p-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">{t.preview}</h3>
            <LutPreviewCanvas matrix={matrix} />
            <div
              className="mt-3 rounded-md border border-line bg-white p-3 text-xs text-slate-600"
              data-testid="lut-editor-matrix-summary"
            >
              {t.matrixSummary(matrix.size, matrix.values.length)}
            </div>
          </aside>
        </div>
        <div className="flex justify-end gap-2 border-t border-line p-4">
          <button
            className="rounded-md border border-line px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-[#176858] disabled:opacity-50"
            type="button"
            onClick={() => void exportCube()}
            disabled={busy}
            data-testid="lut-editor-export-button"
          >
            {busy ? t.exporting : t.export}
          </button>
        </div>
      </div>
    </div>
  );
}

function LutPreviewCanvas({ matrix }: { matrix: ReturnType<typeof buildLutCreatorMatrix> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if (!drawWebGl3dLutPreview(canvas, matrix)) {
      drawCanvasLutPreview(canvas, matrix);
    }
  }, [matrix]);

  return (
    <canvas
      ref={canvasRef}
      className="block aspect-video w-full rounded-md border border-line bg-slate-950"
      width={320}
      height={180}
      data-testid="lut-editor-webgl-preview"
    />
  );
}

function ThreeWayColorEditor({
  threeWayColor,
  onCommit,
}: {
  threeWayColor: ThreeWayColor;
  onCommit(color: ThreeWayColor): void;
}) {
  const normalized = normalizeThreeWayColor(threeWayColor);
  const updateWheel = (key: ThreeWayKey, patch: Partial<ColorWheelValue>) => {
    onCommit(
      normalizeThreeWayColor({
        ...normalized,
        [key]: normalizeColorWheelValue({ ...normalized[key], ...patch }),
      }),
    );
  };

  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="lut-editor-three-way">
      {THREE_WAY_CHANNELS.map((channel) => (
        <ColorWheelControl
          key={channel.key}
          label={channel.label}
          value={normalized[channel.key]}
          onCommit={(patch) => updateWheel(channel.key, patch)}
          testId={`lut-color-wheel-${channel.key}`}
        />
      ))}
      <button
        className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium hover:bg-white sm:col-span-3"
        type="button"
        onClick={() => onCommit(DEFAULT_THREE_WAY_COLOR)}
        data-testid="lut-editor-reset-three-way"
      >
        {zhCN.common.reset}
      </button>
    </div>
  );
}

function ColorWheelControl({
  label,
  value,
  onCommit,
  testId,
}: {
  label: string;
  value: ColorWheelValue;
  onCommit(patch: Partial<ColorWheelValue>): void;
  testId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawColorWheel(canvas, value);
    }
  }, [value]);

  const updateFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      onCommit(wheelPointToOffsets(eventToUnitPoint(event, canvas)));
    }
  };

  return (
    <div className="rounded-md border border-line bg-panel p-2" data-testid={testId}>
      <div className="mb-2 text-xs font-semibold text-slate-700">{label}</div>
      <canvas
        ref={canvasRef}
        className="mx-auto block h-24 w-24 touch-none rounded-full"
        width={96}
        height={96}
        data-testid={`${testId}-canvas`}
        onPointerDown={(event) => {
          updateFromEvent(event);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            updateFromEvent(event);
          }
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
      <RangeNumberField
        label={zhCN.inspector.fields.intensity}
        value={value.intensity}
        min={0}
        max={2}
        step={0.01}
        onCommit={(intensity) => onCommit({ intensity })}
        testId={`${testId}-intensity`}
      />
    </div>
  );
}

function CurveEditor({ curves, onCommit }: { curves: ColorCurves; onCommit(curves: ColorCurves): void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const draftRef = useRef<ColorCurves>(curves);
  const [activeChannel, setActiveChannel] = useState<CurveChannel>('master');
  const [draft, setDraft] = useState<ColorCurves>(curves);

  useEffect(() => {
    const normalized = normalizeColorCurves(curves);
    draftRef.current = normalized;
    setDraft(normalized);
  }, [curves]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawCurveCanvas(
        canvas,
        draft[activeChannel],
        CURVE_CHANNELS.find((item) => item.key === activeChannel)?.color ?? '#e2e8f0',
      );
    }
  }, [activeChannel, draft]);

  const updateActivePoints = (points: CurvePoint[], shouldCommit = false) => {
    const next = normalizeColorCurves({ ...draftRef.current, [activeChannel]: normalizeCurvePoints(points) });
    draftRef.current = next;
    setDraft(next);
    if (shouldCommit) {
      onCommit(next);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const point = eventToCurvePoint(event, canvas);
    const points = normalizeCurvePoints(draftRef.current[activeChannel]);
    const nearest = findNearestCurvePoint(points, point, 0.045);
    if (nearest === null) {
      const nextPoints = normalizeCurvePoints([...points, point]);
      dragIndexRef.current = findNearestCurvePoint(nextPoints, point, 1) ?? nextPoints.length - 1;
      updateActivePoints(nextPoints);
    } else {
      dragIndexRef.current = nearest;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const dragIndex = dragIndexRef.current;
    if (!canvas || dragIndex === null) {
      return;
    }
    const point = eventToCurvePoint(event, canvas);
    const points = normalizeCurvePoints(draftRef.current[activeChannel]);
    points[dragIndex] = point;
    const nextPoints = normalizeCurvePoints(points);
    dragIndexRef.current = findNearestCurvePoint(nextPoints, point, 1) ?? dragIndex;
    updateActivePoints(nextPoints);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragIndexRef.current !== null) {
      dragIndexRef.current = null;
      onCommit(draftRef.current);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleDoubleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const point = eventToCurvePoint(event, canvas);
    const points = normalizeCurvePoints(draftRef.current[activeChannel]);
    const nearest = findNearestCurvePoint(points, point, 0.06);
    if (nearest === null || points.length <= 2) {
      return;
    }
    updateActivePoints(
      points.filter((_, index) => index !== nearest),
      true,
    );
  };

  return (
    <div className="space-y-2 rounded-md border border-line bg-panel p-2" data-testid="lut-editor-curve-editor">
      <div className="grid grid-cols-4 gap-1">
        {CURVE_CHANNELS.map((channel) => (
          <button
            key={channel.key}
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${activeChannel === channel.key ? 'border-brand bg-white text-brand' : 'border-line bg-white text-slate-600 hover:bg-panel'}`}
            type="button"
            data-testid={`lut-curve-tab-${channel.key}`}
            onClick={() => setActiveChannel(channel.key)}
          >
            {channel.label}
          </button>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        className="block h-64 w-64 touch-none rounded border border-line bg-slate-950"
        width={256}
        height={256}
        data-testid="lut-curve-editor-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />
      <button
        className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
        type="button"
        data-testid="lut-editor-reset-curves"
        onClick={() => {
          const next = createDefaultColorCurves();
          draftRef.current = next;
          setDraft(next);
          onCommit(next);
        }}
      >
        {zhCN.inspector.fields.resetCurve}
      </button>
    </div>
  );
}

function RangeNumberField({
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
  const commitClamped = (nextValue: number) => {
    if (Number.isFinite(nextValue)) {
      onCommit(Math.min(max, Math.max(min, nextValue)));
    }
  };
  return (
    <label className="mt-2 block text-xs font-medium text-slate-600">
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
          data-testid={testId}
        />
      </span>
      <input
        className="mt-1 w-full accent-brand"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => commitClamped(Number(event.target.value))}
      />
    </label>
  );
}

function drawWebGl3dLutPreview(canvas: HTMLCanvasElement, matrix: ReturnType<typeof buildLutCreatorMatrix>): boolean {
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    return false;
  }
  const program = createPreviewProgram(gl);
  if (!program) {
    return false;
  }
  const texture = gl.createTexture();
  const buffer = gl.createBuffer();
  if (!texture || !buffer) {
    return false;
  }
  const data = new Uint8Array(
    matrix.values.flatMap((color) => [
      Math.round(color.r * 255),
      Math.round(color.g * 255),
      Math.round(color.b * 255),
      255,
    ]),
  );
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, matrix.size, matrix.size, matrix.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.useProgram(program);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const lut = gl.getUniformLocation(program, 'u_lut');
  if (!lut) {
    return false;
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.uniform1i(lut, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return true;
}

function createPreviewProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vertex = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `#version 300 es
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `,
  );
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision highp float;
    precision highp sampler3D;
    uniform sampler3D u_lut;
    in vec2 v_uv;
    out vec4 outColor;
    void main() {
      float slice = smoothstep(0.0, 1.0, v_uv.x * 0.35 + v_uv.y * 0.65);
      outColor = vec4(texture(u_lut, vec3(v_uv.x, 1.0 - v_uv.y, slice)).rgb, 1.0);
    }
  `,
  );
  if (!vertex || !fragment) {
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function drawCanvasLutPreview(canvas: HTMLCanvasElement, matrix: ReturnType<typeof buildLutCreatorMatrix>): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const image = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const red = Math.round((x / Math.max(1, canvas.width - 1)) * (matrix.size - 1));
      const green = Math.round((1 - y / Math.max(1, canvas.height - 1)) * (matrix.size - 1));
      const blue = Math.round(((x + y) / Math.max(1, canvas.width + canvas.height - 2)) * (matrix.size - 1));
      const color = matrix.values[red + green * matrix.size + blue * matrix.size * matrix.size] ?? { r: 0, g: 0, b: 0 };
      const offset = (y * canvas.width + x) * 4;
      image.data[offset] = Math.round(color.r * 255);
      image.data[offset + 1] = Math.round(color.g * 255);
      image.data[offset + 2] = Math.round(color.b * 255);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

function drawCurveCanvas(canvas: HTMLCanvasElement, points: CurvePoint[], strokeColor: string): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const position = (index / 4) * width;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, height);
    context.moveTo(0, position);
    context.lineTo(width, position);
    context.stroke();
  }
  context.strokeStyle = strokeColor;
  context.lineWidth = 2;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const sampleX = x / (width - 1);
    const sampleY = sampleCurve(points, sampleX);
    const y = (1 - sampleY) * (height - 1);
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
  for (const point of normalizeCurvePoints(points)) {
    context.beginPath();
    context.fillStyle = '#ffffff';
    context.arc(point.x * width, (1 - point.y) * height, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = strokeColor;
    context.lineWidth = 2;
    context.stroke();
  }
}

function eventToCurvePoint(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): CurvePoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp01((event.clientX - rect.left) / rect.width),
    y: clamp01(1 - (event.clientY - rect.top) / rect.height),
  };
}

function findNearestCurvePoint(points: CurvePoint[], point: CurvePoint, maxDistance: number): number | null {
  let nearestIndex: number | null = null;
  let nearestDistance = maxDistance;
  points.forEach((candidate, index) => {
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function drawColorWheel(canvas: HTMLCanvasElement, value: ColorWheelValue): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const size = canvas.width;
  const radius = size / 2;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - radius) / radius;
      const dy = (y + 0.5 - radius) / radius;
      const distance = Math.hypot(dx, dy);
      const offset = (y * size + x) * 4;
      if (distance > 1) {
        image.data[offset + 3] = 0;
        continue;
      }
      const hue = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
      const rgb = hsvToRgb(hue, distance, 1);
      image.data[offset] = Math.round(rgb.r * 255);
      image.data[offset + 1] = Math.round(rgb.g * 255);
      image.data[offset + 2] = Math.round(rgb.b * 255);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const marker = wheelOffsetsToPoint(value);
  context.beginPath();
  context.arc(radius + marker.x * radius, radius + marker.y * radius, 5, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.strokeStyle = '#0f172a';
  context.lineWidth = 2;
  context.stroke();
}

function eventToUnitPoint(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  const length = Math.hypot(x, y);
  return length <= 1 ? { x, y } : { x: x / length, y: y / length };
}

function wheelPointToOffsets(point: { x: number; y: number }): Pick<ColorWheelValue, 'r' | 'g' | 'b'> {
  return {
    r: clampSigned(point.x),
    g: clampSigned(-0.5 * point.x - 0.8660254 * point.y),
    b: clampSigned(-0.5 * point.x + 0.8660254 * point.y),
  };
}

function wheelOffsetsToPoint(value: ColorWheelValue): { x: number; y: number } {
  const x = value.r;
  const y = (value.b - value.g) / 1.7320508;
  const length = Math.hypot(x, y);
  return length <= 1 ? { x, y } : { x: x / length, y: y / length };
}

function hsvToRgb(hue: number, saturation: number, value: number): { r: number; g: number; b: number } {
  const sector = Math.floor(hue * 6);
  const fraction = hue * 6 - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const tt = value * (1 - (1 - fraction) * saturation);
  switch (sector % 6) {
    case 0:
      return { r: value, g: tt, b: p };
    case 1:
      return { r: q, g: value, b: p };
    case 2:
      return { r: p, g: value, b: tt };
    case 3:
      return { r: p, g: q, b: value };
    case 4:
      return { r: tt, g: p, b: value };
    default:
      return { r: value, g: p, b: q };
  }
}

function fileNameFromPath(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

function sanitizeFileBaseName(name: string): string {
  return (
    name
      .trim()
      .replace(/\.cube$/i, '')
      .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim() || 'open-factory-lut'
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0));
}
