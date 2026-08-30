/**
 * Dev-only performance overlay.
 * Shows render counts, FPS gauge, and store subscription log.
 * Gated behind __DEV_PERF_MONITOR__ — zero bundle impact in production.
 */
import { useState, useCallback, useEffect } from 'react';
import { usePerfMonitor, trackRender } from '../hooks/usePerfMonitor';

declare const __DEV_PERF_MONITOR__: boolean;

function FpsBar({ fps }: { fps: number }) {
  const width = Math.min(fps, 60);
  const color = fps >= 50 ? '#22c55e' : fps >= 30 ? '#eab308' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            width: `${(width / 60) * 100}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
            transition: 'width 0.2s',
          }}
        />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 600, minWidth: 36 }}>{fps} fps</span>
    </div>
  );
}

function RenderCountsPanel({ counts }: { counts: ReadonlyMap<string, number> }) {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (sorted.length === 0) return <div style={{ color: '#888', fontSize: 11 }}>No renders tracked</div>;
  return (
    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
      {sorted.map(([name, count]) => (
        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0' }}>
          <span
            style={{ color: '#ccc', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {name}
          </span>
          <span style={{ color: count > 100 ? '#ef4444' : count > 30 ? '#eab308' : '#22c55e', fontWeight: 600 }}>
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

function SubscriptionsPanel({ subs }: { subs: readonly { store: string; field: string; timestamp: number }[] }) {
  const recent = subs.slice(-15).reverse();
  if (recent.length === 0) return <div style={{ color: '#888', fontSize: 11 }}>No subscriptions logged</div>;
  return (
    <div style={{ maxHeight: 150, overflowY: 'auto' }}>
      {recent.map((ev, i) => (
        <div key={i} style={{ fontSize: 10, padding: '1px 0', display: 'flex', gap: 4 }}>
          <span style={{ color: '#60a5fa' }}>{ev.store}</span>
          <span style={{ color: '#888' }}>.</span>
          <span style={{ color: '#a78bfa' }}>{ev.field}</span>
        </div>
      ))}
    </div>
  );
}

type Tab = 'renders' | 'subs';

/**
 * The dev perf overlay component.
 * Only renders when __DEV_PERF_MONITOR__ is true.
 */
export function DevPerfOverlay() {
  if (typeof __DEV_PERF_MONITOR__ === 'undefined' || !__DEV_PERF_MONITOR__) return null;
  return <DevPerfOverlayInner />;
}

function DevPerfOverlayInner() {
  const data = usePerfMonitor();
  const [tab, setTab] = useState<Tab>('renders');
  const [collapsed, setCollapsed] = useState(false);

  // e2e 下 overlay 只作"可见"的性能证据（没有任何 spec 与它交互），但其固定
  // 右下定位会系统性拦截底部全宽面板/居中对话框的右下点击（preflight-checklist:55、
  // dubbing-adaptation:47 等已知 7 例；四个角落均有 spec 依赖的点击入口，移动位置
  // 只是移动受害者）。故 e2e 下整体点击穿透、从根上消除拦截；人工 dev 保留原有
  // 交互；生产不渲染本组件。
  const e2eClickThrough = import.meta.env.VITE_E2E === 'true';

  // 统计自身渲染次数必须放在 commit 之后（useEffect）：在渲染函数体内调用
  // trackRender 会在渲染相位内同步通知订阅者（本组件自身也订阅了渲染计数），
  // 形成"渲染→通知→重渲染"的无限闭环（issue #114 根因）。
  useEffect(() => {
    trackRender('DevPerfOverlay');
  });

  const tabBtn = useCallback(
    (t: Tab, label: string) => (
      <button
        onClick={() => setTab(t)}
        style={{
          background: tab === t ? '#3b82f6' : 'transparent',
          color: tab === t ? '#fff' : '#999',
          border: 'none',
          borderRadius: 3,
          padding: '2px 6px',
          fontSize: 10,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    ),
    [tab],
  );

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{
          position: 'fixed',
          bottom: 8,
          right: 8,
          zIndex: 99999,
          background: 'rgba(0,0,0,0.85)',
          borderRadius: 6,
          padding: '4px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          pointerEvents: e2eClickThrough ? 'none' : undefined,
        }}
      >
        <FpsBar fps={data.fps.current} />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        zIndex: 99999,
        background: 'rgba(15,15,15,0.94)',
        border: '1px solid #333',
        borderRadius: 8,
        padding: 10,
        width: 260,
        fontFamily: 'monospace',
        color: '#eee',
        fontSize: 11,
        backdropFilter: 'blur(8px)',
        pointerEvents: e2eClickThrough ? 'none' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>Perf Monitor</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => data.resetRenderCounts()}
            style={{
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: 3,
              color: '#999',
              fontSize: 9,
              cursor: 'pointer',
              padding: '1px 4px',
            }}
          >
            Reset
          </button>
          <button
            onClick={() => setCollapsed(true)}
            style={{
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: 3,
              color: '#999',
              fontSize: 9,
              cursor: 'pointer',
              padding: '1px 4px',
            }}
          >
            _
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ color: '#888' }}>FPS</span>
          <span style={{ color: '#666', fontSize: 9 }}>
            avg {data.fps.avg} / min {data.fps.min}
          </span>
        </div>
        <FpsBar fps={data.fps.current} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {tabBtn('renders', 'Renders')}
        {tabBtn('subs', 'Subscriptions')}
      </div>

      {tab === 'renders' && <RenderCountsPanel counts={data.renderCounts} />}
      {tab === 'subs' && (
        <>
          <SubscriptionsPanel subs={data.subscriptions} />
          <button
            onClick={() => data.clearSubscriptions()}
            style={{
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: 3,
              color: '#999',
              fontSize: 9,
              cursor: 'pointer',
              padding: '1px 4px',
              marginTop: 4,
            }}
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}
