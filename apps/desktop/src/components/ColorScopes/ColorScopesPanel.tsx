import type { ColorScopes } from '@open-factory/editor-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { zhCN } from '../../i18n/strings';
import type { PreviewFrameReadback } from '../../lib/preview/renderer';
import { useTheme } from '../../theme/useTheme';
import type { ColorScopesWorkerRequest, ColorScopesWorkerResponse } from '../../workers/color-scopes.worker';

type ScopeTab = 'histogram' | 'waveform' | 'vectorscope';
interface ScopeDrawColors {
  background: string;
  guide: string;
}

export function ColorScopesPanel({ frame, active }: { frame?: PreviewFrameReadback; active: boolean }) {
  const theme = useTheme();
  const [tab, setTab] = useState<ScopeTab>('histogram');
  const [scopes, setScopes] = useState<ColorScopes>();
  const workerRef = useRef<Worker>();
  const drawColors = useMemo<ScopeDrawColors>(
    () => ({
      background: theme.colors.scopeBackground,
      guide: theme.colors.scopeGuide,
    }),
    [theme.colors.scopeBackground, theme.colors.scopeGuide],
  );

  useEffect(() => {
    if (!active || !frame || frame.data.length === 0) {
      return;
    }
    workerRef.current ??= new Worker(new URL('../../workers/color-scopes.worker.ts', import.meta.url), {
      type: 'module',
    });
    const worker = workerRef.current;
    const onMessage = (event: MessageEvent<ColorScopesWorkerResponse>) => {
      if (event.data.scopes) {
        setScopes(event.data.scopes);
      }
    };
    worker.addEventListener('message', onMessage);
    const data = new Uint8Array(frame.data);
    const request: ColorScopesWorkerRequest = {
      width: frame.width,
      height: frame.height,
      data,
      waveformColumns: 160,
    };
    worker.postMessage(request, [data.buffer]);
    return () => {
      worker.removeEventListener('message', onMessage);
    };
  }, [active, frame]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = undefined;
    },
    [],
  );

  return (
    <section
      className="min-h-0 border-t"
      data-testid="color-scopes-panel"
      data-theme-scope-background={drawColors.background}
      style={{ backgroundColor: drawColors.background, borderColor: theme.colors.border }}
    >
      <div className="flex h-9 items-center justify-between border-b px-3" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center gap-1">
          <ScopeTabButton
            id="histogram"
            label={zhCN.scopes.histogram}
            active={tab === 'histogram'}
            onClick={() => setTab('histogram')}
          />
          <ScopeTabButton
            id="waveform"
            label={zhCN.scopes.waveform}
            active={tab === 'waveform'}
            onClick={() => setTab('waveform')}
          />
          <ScopeTabButton
            id="vectorscope"
            label={zhCN.scopes.vectorscope}
            active={tab === 'vectorscope'}
            onClick={() => setTab('vectorscope')}
          />
        </div>
      </div>
      <div className="h-[140px] px-3 py-2">
        {tab === 'histogram' ? <HistogramCanvas scopes={scopes} colors={drawColors} /> : null}
        {tab === 'waveform' ? <WaveformCanvas scopes={scopes} colors={drawColors} /> : null}
        {tab === 'vectorscope' ? <VectorscopeCanvas scopes={scopes} colors={drawColors} /> : null}
      </div>
    </section>
  );
}

function ScopeTabButton({
  id,
  label,
  active,
  onClick,
}: {
  id: ScopeTab;
  label: string;
  active: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className={`h-7 rounded border px-2 text-[11px] font-medium ${
        active
          ? 'border-emerald-400 bg-emerald-400/15 text-white'
          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
      }`}
      data-testid={`color-scope-tab-${id}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function HistogramCanvas({ scopes, colors }: { scopes?: ColorScopes; colors: ScopeDrawColors }) {
  const ref = useCanvas(
    (context, width, height) => {
      drawScopeBackground(context, width, height, colors);
      if (!scopes) {
        return;
      }
      const max = Math.max(1, ...scopes.histogram.r, ...scopes.histogram.g, ...scopes.histogram.b);
      drawHistogramChannel(context, scopes.histogram.r, max, width, height, 'rgba(239,68,68,0.72)');
      drawHistogramChannel(context, scopes.histogram.g, max, width, height, 'rgba(34,197,94,0.72)');
      drawHistogramChannel(context, scopes.histogram.b, max, width, height, 'rgba(59,130,246,0.72)');
    },
    [scopes, colors],
  );
  return <canvas ref={ref} width={520} height={140} className="h-full w-full" data-testid="color-scope-histogram" />;
}

function WaveformCanvas({ scopes, colors }: { scopes?: ColorScopes; colors: ScopeDrawColors }) {
  const ref = useCanvas(
    (context, width, height) => {
      drawScopeBackground(context, width, height, colors);
      drawHorizontalGuide(context, width, height, 0.5);
      if (!scopes) {
        return;
      }
      const columns = scopes.waveform.columns;
      const max = Math.max(1, ...columns.flat());
      context.fillStyle = 'rgba(125,211,252,0.6)';
      columns.forEach((column, columnIndex) => {
        const x = (columnIndex / Math.max(1, columns.length - 1)) * width;
        column.forEach((count, ire) => {
          if (count <= 0) {
            return;
          }
          context.globalAlpha = Math.min(0.85, 0.12 + count / max);
          context.fillRect(x, height - (ire / 100) * height, 1.5, 1.5);
        });
      });
      context.globalAlpha = 1;
    },
    [scopes, colors],
  );
  return <canvas ref={ref} width={520} height={140} className="h-full w-full" data-testid="color-scope-waveform" />;
}

function VectorscopeCanvas({ scopes, colors }: { scopes?: ColorScopes; colors: ScopeDrawColors }) {
  const ref = useCanvas(
    (context, width, height) => {
      drawScopeBackground(context, width, height, colors);
      const radius = Math.min(width, height) * 0.42;
      const centerX = width / 2;
      const centerY = height / 2;
      context.strokeStyle = colors.guide;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = 'rgba(251,146,60,0.65)';
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.lineTo(
        centerX + Math.cos((123 * Math.PI) / 180) * radius,
        centerY - Math.sin((123 * Math.PI) / 180) * radius,
      );
      context.stroke();
      if (!scopes) {
        return;
      }
      const max = Math.max(1, ...scopes.vectorscope.map((point) => point.count));
      for (const point of scopes.vectorscope) {
        context.globalAlpha = Math.min(0.9, 0.15 + point.count / max);
        context.fillStyle = 'rgb(167,243,208)';
        context.fillRect(centerX + point.x * radius, centerY - point.y * radius, 2, 2);
      }
      context.globalAlpha = 1;
    },
    [scopes, colors],
  );
  return <canvas ref={ref} width={520} height={140} className="h-full w-full" data-testid="color-scope-vectorscope" />;
}

function useCanvas(draw: (context: CanvasRenderingContext2D, width: number, height: number) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    draw(context, canvas.width, canvas.height);
  }, deps);
  return ref;
}

function drawScopeBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: ScopeDrawColors,
): void {
  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = colors.guide;
  context.lineWidth = 1;
  for (let index = 1; index < 4; index += 1) {
    drawHorizontalGuide(context, width, height, index / 4);
  }
}

function drawHorizontalGuide(context: CanvasRenderingContext2D, width: number, height: number, ratio: number): void {
  const y = Math.round(height * ratio) + 0.5;
  context.beginPath();
  context.moveTo(0, y);
  context.lineTo(width, y);
  context.stroke();
}

function drawHistogramChannel(
  context: CanvasRenderingContext2D,
  buckets: number[],
  max: number,
  width: number,
  height: number,
  color: string,
): void {
  context.strokeStyle = color;
  context.beginPath();
  buckets.forEach((count, index) => {
    const x = (index / 255) * width;
    const y = height - (count / max) * height;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
}
