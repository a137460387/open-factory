import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getNoiseReductionPreset,
  getNoiseReductionPresetLabel,
  getNoiseReductionPresets,
  normalizeNoiseReductionParams,
  strengthToNoiseReductionParams,
  estimateNoiseReduction,
  buildNoiseReductionFilterString,
  type NoiseReductionParams,
  type NoiseReductionPreset,
} from '@open-factory/editor-core';
import { Volume2, Zap, Play, RotateCcw } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { useEditorStore } from '../../store/editorStore';
import { useMixerStore } from '../../store/mixerStore';

interface NoiseReductionDialogProps {
  open: boolean;
  onClose: () => void;
  trackId?: string;
}

export function NoiseReductionDialog({ open, onClose, trackId }: NoiseReductionDialogProps) {
  const project = useEditorStore((s) => s.project);
  const tracks = useMemo(
    () => project.timeline.tracks.filter((t) => t.type === 'audio' || t.type === 'video'),
    [project.timeline.tracks],
  );

  const [selectedTrackId, setSelectedTrackId] = useState(trackId ?? tracks[0]?.id ?? '');
  const [preset, setPreset] = useState<NoiseReductionPreset>('medium');
  const [params, setParams] = useState<NoiseReductionParams>(getNoiseReductionPreset('medium'));
  const [strength, setStrength] = useState(50);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    beforePeakDb: number;
    afterPeakDb: number;
    snrImprovement: number;
  } | null>(null);

  const setNoiseReductionParams = useMixerStore((s) => s.setNoiseReductionParams);
  const setNoiseReductionPreviewTrackId = useMixerStore((s) => s.setNoiseReductionPreviewTrackId);

  useEffect(() => {
    if (trackId) {
      setSelectedTrackId(trackId);
    }
  }, [trackId]);

  const handlePresetChange = useCallback((newPreset: NoiseReductionPreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const presetParams = getNoiseReductionPreset(newPreset);
      setParams(presetParams);
      // 将预设映射到强度百分比
      const strengthMap: Record<string, number> = {
        light: 25,
        medium: 50,
        heavy: 85,
      };
      setStrength(strengthMap[newPreset] ?? 50);
    }
  }, []);

  const handleStrengthChange = useCallback((newStrength: number) => {
    setStrength(newStrength);
    setParams(strengthToNoiseReductionParams(newStrength));
    setPreset('custom');
  }, []);

  const handleParamChange = useCallback((key: keyof NoiseReductionParams, value: number | boolean) => {
    setParams((prev) => normalizeNoiseReductionParams({ ...prev, [key]: value }));
    setPreset('custom');
  }, []);

  const handlePreview = useCallback(() => {
    setIsPreviewPlaying(true);
    setNoiseReductionPreviewTrackId(selectedTrackId);

    // 模拟预览结果
    const estimated = estimateNoiseReduction(params, 0);
    setPreviewResult({
      beforePeakDb: estimated.beforePeakDb,
      afterPeakDb: estimated.afterPeakDb,
      snrImprovement: estimated.snrImprovement,
    });

    // 2秒后停止预览
    setTimeout(() => {
      setIsPreviewPlaying(false);
      setNoiseReductionPreviewTrackId(null);
    }, 2000);
  }, [params, selectedTrackId, setNoiseReductionPreviewTrackId]);

  const handleApply = useCallback(() => {
    setNoiseReductionParams(selectedTrackId, params);
    onClose();
  }, [selectedTrackId, params, setNoiseReductionParams, onClose]);

  const handleReset = useCallback(() => {
    setPreset('medium');
    setParams(getNoiseReductionPreset('medium'));
    setStrength(50);
    setPreviewResult(null);
  }, []);

  const filterString = useMemo(() => buildNoiseReductionFilterString(params), [params]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="noise-reduction-dialog"
    >
      <div className="w-full max-w-lg rounded-lg border border-line bg-white shadow-xl">
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Volume2 size={18} className="text-brand" />
            <h2 className="text-sm font-semibold text-slate-800">智能降噪</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            data-testid="noise-reduction-close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* 轨道选择 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">目标轨道</label>
            <select
              className="h-8 w-full rounded border border-line bg-white px-2 text-sm"
              value={selectedTrackId}
              onChange={(e) => setSelectedTrackId(e.target.value)}
              data-testid="noise-reduction-track-select"
            >
              {tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          </div>

          {/* 预设选择 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">降噪预设</label>
            <div className="grid grid-cols-4 gap-2">
              {getNoiseReductionPresets().map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetChange(p)}
                  className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                    preset === p ? 'bg-brand text-white' : 'border border-line bg-white text-slate-600 hover:bg-panel'
                  }`}
                  data-testid={`noise-reduction-preset-${p}`}
                >
                  {getNoiseReductionPresetLabel(p)}
                </button>
              ))}
            </div>
          </div>

          {/* 强度滑块 */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">降噪强度</label>
              <span className="text-xs tabular-nums text-slate-500">{strength}%</span>
            </div>
            <input
              className="w-full accent-brand"
              type="range"
              min={0}
              max={100}
              step={1}
              value={strength}
              onChange={(e) => handleStrengthChange(Number(e.target.value))}
              data-testid="noise-reduction-strength"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>轻度</span>
              <span>中度</span>
              <span>强力</span>
            </div>
          </div>

          {/* 高级参数 */}
          <div className="rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs font-semibold text-slate-700">高级参数</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">噪声底限 (dB)</label>
                <input
                  className="h-7 w-full rounded border border-line bg-white px-2 text-right text-xs tabular-nums"
                  type="number"
                  min={-60}
                  max={0}
                  step={1}
                  value={params.noiseFloor}
                  onChange={(e) => handleParamChange('noiseFloor', Number(e.target.value))}
                  data-testid="noise-reduction-noise-floor"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">降噪类型</label>
                <select
                  className="h-7 w-full rounded border border-line bg-white px-2 text-xs"
                  value={params.nrType}
                  onChange={(e) => handleParamChange('nrType', Number(e.target.value))}
                  data-testid="noise-reduction-type"
                >
                  <option value={0}>弱降噪</option>
                  <option value={1}>中降噪</option>
                  <option value={2}>强降噪</option>
                </select>
              </div>
            </div>

            <div className="mt-2">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={params.autoNoiseSampling}
                  onChange={(e) => handleParamChange('autoNoiseSampling', e.target.checked ? 1 : 0)}
                  data-testid="noise-reduction-auto-sampling"
                />
                自动噪声采样
              </label>
            </div>
          </div>

          {/* 预览结果 */}
          {previewResult && (
            <div
              className="rounded border border-emerald-200 bg-emerald-50 p-3"
              data-testid="noise-reduction-preview-result"
            >
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <Zap size={14} />
                预览结果
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-emerald-600">信噪比改善</div>
                  <div className="text-sm font-bold text-emerald-800">+{previewResult.snrImprovement} dB</div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-600">处理前峰值</div>
                  <div className="text-sm font-bold text-emerald-800">{previewResult.beforePeakDb.toFixed(1)} dB</div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-600">处理后峰值</div>
                  <div className="text-sm font-bold text-emerald-800">{previewResult.afterPeakDb.toFixed(1)} dB</div>
                </div>
              </div>
            </div>
          )}

          {/* FFmpeg 滤镜预览 */}
          <div className="rounded border border-slate-200 bg-slate-50 p-2">
            <div className="mb-1 text-[10px] font-medium text-slate-500">FFmpeg 滤镜</div>
            <code className="block truncate text-xs text-slate-700">{filterString}</code>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isPreviewPlaying}
              className="flex items-center gap-1 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-panel disabled:opacity-50"
              data-testid="noise-reduction-preview"
            >
              <Play size={12} />
              {isPreviewPlaying ? '预览中...' : '预览效果'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-panel"
              data-testid="noise-reduction-reset"
            >
              <RotateCcw size={12} />
              重置
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-line bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-panel"
              data-testid="noise-reduction-cancel"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              data-testid="noise-reduction-apply"
            >
              应用降噪
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
