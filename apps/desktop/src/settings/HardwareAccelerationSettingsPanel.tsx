/**
 * 硬件加速设置面板
 *
 * 允许用户配置视频解码的硬件加速选项
 */

import { useEffect, useState } from 'react';
import { Cpu, Zap, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { zhCN } from '../i18n/strings';
import {
  type HardwareCapabilities,
  type HardwareBackend,
  type HardwareBackendInfo,
  getHwDecodeCapabilities,
} from '../lib/tauri-bridge';
import {
  type HardwareAccelerationSettings,
  type HardwareAccelerationMode,
  type HardwareAccelerationBackend,
  DEFAULT_HARDWARE_ACCELERATION_SETTINGS,
  readHardwareAccelerationSettings,
  saveHardwareAccelerationSettings,
} from './appSettings';

const t = zhCN.settings.hardwareAcceleration;

interface HardwareAccelerationSettingsPanelProps {
  onSettingsChange?: (settings: HardwareAccelerationSettings) => void;
}

export function HardwareAccelerationSettingsPanel({ onSettingsChange }: HardwareAccelerationSettingsPanelProps) {
  const [settings, setSettings] = useState<HardwareAccelerationSettings>(DEFAULT_HARDWARE_ACCELERATION_SETTINGS);
  const [capabilities, setCapabilities] = useState<HardwareCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载设置
  useEffect(() => {
    void (async () => {
      try {
        const [savedSettings, caps] = await Promise.all([
          readHardwareAccelerationSettings(),
          getHwDecodeCapabilities(),
        ]);
        setSettings(savedSettings);
        setCapabilities(caps);
      } catch (err) {
        setError(err instanceof Error ? err.message : '无法加载硬件加速设置');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 更新设置
  const updateSettings = async (partial: Partial<HardwareAccelerationSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    try {
      await saveHardwareAccelerationSettings(partial);
      onSettingsChange?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法保存设置');
    }
  };

  // 刷新硬件能力
  const refreshCapabilities = async () => {
    setLoading(true);
    setError(null);
    try {
      const caps = await getHwDecodeCapabilities();
      setCapabilities(caps);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法检测硬件加速能力');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !capabilities) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm text-slate-500">正在检测硬件加速能力...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-600">
          <AlertCircle className="mr-1 inline-block h-3 w-3" />
          {error}
        </div>
      )}

      {/* 硬件加速模式 */}
      <div className="rounded-md border border-line bg-panel p-3">
        <h4 className="mb-2 text-xs font-semibold text-slate-700">{t.modeTitle}</h4>
        <p className="mb-3 text-xs text-slate-500">{t.modeDescription}</p>

        <div className="space-y-2">
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              className="mt-0.5 h-4 w-4 accent-brand"
              type="radio"
              name="hw-accel-mode"
              checked={settings.mode === 'auto'}
              onChange={() => void updateSettings({ mode: 'auto' })}
            />
            <span>
              <span className="block font-semibold text-slate-700">{t.modeAuto}</span>
              <span className="mt-1 block">{t.modeAutoDescription}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              className="mt-0.5 h-4 w-4 accent-brand"
              type="radio"
              name="hw-accel-mode"
              checked={settings.mode === 'enabled'}
              onChange={() => void updateSettings({ mode: 'enabled' })}
            />
            <span>
              <span className="block font-semibold text-slate-700">{t.modeEnabled}</span>
              <span className="mt-1 block">{t.modeEnabledDescription}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              className="mt-0.5 h-4 w-4 accent-brand"
              type="radio"
              name="hw-accel-mode"
              checked={settings.mode === 'disabled'}
              onChange={() => void updateSettings({ mode: 'disabled' })}
            />
            <span>
              <span className="block font-semibold text-slate-700">{t.modeDisabled}</span>
              <span className="mt-1 block">{t.modeDisabledDescription}</span>
            </span>
          </label>
        </div>
      </div>

      {/* 首选后端 */}
      {settings.mode !== 'disabled' && (
        <div className="rounded-md border border-line bg-panel p-3">
          <h4 className="mb-2 text-xs font-semibold text-slate-700">{t.preferredBackendTitle}</h4>
          <p className="mb-3 text-xs text-slate-500">{t.preferredBackendDescription}</p>

          <select
            className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={settings.preferredBackend}
            onChange={(e) => void updateSettings({ preferredBackend: e.target.value as HardwareAccelerationBackend })}
          >
            <option value="auto">{t.backendAuto}</option>
            <option value="cuda">{t.backendCuda}</option>
            <option value="vaapi">{t.backendVaapi}</option>
            <option value="quicksync">{t.backendQuickSync}</option>
            <option value="videotoolbox">{t.backendVideoToolbox}</option>
            <option value="d3d11va">{t.backendD3d11va}</option>
          </select>
        </div>
      )}

      {/* 帧缓存设置 */}
      {settings.mode !== 'disabled' && (
        <div className="rounded-md border border-line bg-panel p-3">
          <h4 className="mb-2 text-xs font-semibold text-slate-700">{t.frameCacheTitle}</h4>
          <p className="mb-3 text-xs text-slate-500">{t.frameCacheDescription}</p>

          <label className="mb-3 flex items-start gap-2 text-xs text-slate-600">
            <input
              className="mt-0.5 h-4 w-4 accent-brand"
              type="checkbox"
              checked={settings.enableFrameCache}
              onChange={(e) => void updateSettings({ enableFrameCache: e.target.checked })}
            />
            <span>
              <span className="block font-semibold text-slate-700">{t.enableFrameCache}</span>
              <span className="mt-1 block">{t.enableFrameCacheDescription}</span>
            </span>
          </label>

          {settings.enableFrameCache && (
            <label className="block text-xs font-medium text-slate-600">
              {t.frameCacheSize}
              <input
                className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                type="number"
                min={5}
                max={100}
                value={settings.frameCacheSize}
                onChange={(e) => void updateSettings({ frameCacheSize: parseInt(e.target.value, 10) || 30 })}
              />
            </label>
          )}
        </div>
      )}

      {/* 预解码设置 */}
      {settings.mode !== 'disabled' && (
        <div className="rounded-md border border-line bg-panel p-3">
          <h4 className="mb-2 text-xs font-semibold text-slate-700">{t.preDecodeTitle}</h4>
          <p className="mb-3 text-xs text-slate-500">{t.preDecodeDescription}</p>

          <label className="mb-3 flex items-start gap-2 text-xs text-slate-600">
            <input
              className="mt-0.5 h-4 w-4 accent-brand"
              type="checkbox"
              checked={settings.enablePreDecode}
              onChange={(e) => void updateSettings({ enablePreDecode: e.target.checked })}
            />
            <span>
              <span className="block font-semibold text-slate-700">{t.enablePreDecode}</span>
              <span className="mt-1 block">{t.enablePreDecodeDescription}</span>
            </span>
          </label>

          {settings.enablePreDecode && (
            <label className="block text-xs font-medium text-slate-600">
              {t.preDecodeFrameCount}
              <input
                className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                type="number"
                min={1}
                max={30}
                value={settings.preDecodeFrameCount}
                onChange={(e) => void updateSettings({ preDecodeFrameCount: parseInt(e.target.value, 10) || 5 })}
              />
            </label>
          )}
        </div>
      )}

      {/* 硬件能力检测结果 */}
      {capabilities && (
        <div className="rounded-md border border-line bg-panel p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700">{t.capabilitiesTitle}</h4>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => void refreshCapabilities()}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {t.refresh}
            </Button>
          </div>

          <div className="mb-2 rounded-md bg-slate-50 p-2 text-xs">
            <span className="font-semibold text-slate-700">{t.recommendedBackend}: </span>
            <span className="text-slate-600">{getBackendDisplayName(capabilities.recommendedBackend)}</span>
          </div>

          <div className="space-y-2">
            {capabilities.availableBackends.map((backend) => (
              <BackendStatus key={backend.backend} backend={backend} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BackendStatus({ backend }: { backend: HardwareBackendInfo }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-white px-2 py-1.5">
      <div className="flex items-center gap-2">
        {backend.available ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
        )}
        <span className="text-xs font-medium text-slate-700">{getBackendDisplayName(backend.backend)}</span>
      </div>
      <div className="text-xs text-slate-500">
        {backend.available ? t.backendAvailable : t.backendUnavailable}
      </div>
    </div>
  );
}

function getBackendDisplayName(backend: HardwareBackend): string {
  const names: Record<HardwareBackend, string> = {
    Cuda: 'CUDA (NVIDIA)',
    Vaapi: 'VAAPI (AMD/Intel Linux)',
    QuickSync: 'QuickSync (Intel)',
    VideoToolbox: 'VideoToolbox (macOS)',
    D3d11va: 'D3D11VA (Windows)',
    Auto: '自动选择',
    Software: '软件解码',
  };
  return names[backend] ?? backend;
}
