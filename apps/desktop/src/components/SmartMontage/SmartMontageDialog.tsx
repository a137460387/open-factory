import { useState, useCallback, useMemo } from 'react';
import { Wand2, X, Loader2, Music, Film, ChevronRight } from 'lucide-react';
import type { BeatSensitivity, MediaAsset } from '@open-factory/editor-core';
import { estimateBpmFromTimes } from '@open-factory/editor-core';
import { formatTimeShort } from '@open-factory/editor-core/utils/time';
import { detectBeats } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

type MontageStep = 'select' | 'analyze' | 'preview';

interface SmartMontageDialogProps {
  media: MediaAsset[];
  initialVideoIds?: string[];
  onGenerate(config: {
    videoAssetIds: string[];
    audioAssetId: string;
    beatTimes: number[];
    sensitivity: BeatSensitivity;
  }): void;
  onClose(): void;
}

export function SmartMontageDialog({ media, initialVideoIds = [], onGenerate, onClose }: SmartMontageDialogProps) {
  const videoAssets = useMemo(() => media.filter((a) => a.type === 'video' || a.type === 'image'), [media]);
  const audioAssets = useMemo(() => media.filter((a) => a.type === 'audio'), [media]);

  const [step, setStep] = useState<MontageStep>('select');
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>(() =>
    initialVideoIds.length > 0 ? initialVideoIds : videoAssets.slice(0, 5).map((a) => a.id),
  );
  const [selectedAudioId, setSelectedAudioId] = useState<string>(() => audioAssets[0]?.id ?? '');
  const [sensitivity, setSensitivity] = useState<BeatSensitivity>('medium');
  const [analyzing, setAnalyzing] = useState(false);
  const [beatTimes, setBeatTimes] = useState<number[]>([]);
  const [estimatedBpm, setEstimatedBpm] = useState(0);

  const selectedVideoAssets = useMemo(
    () =>
      selectedVideoIds.flatMap((id) => {
        const a = media.find((m) => m.id === id);
        return a ? [a] : [];
      }),
    [media, selectedVideoIds],
  );
  const selectedAudioAsset = useMemo(() => media.find((m) => m.id === selectedAudioId), [media, selectedAudioId]);

  const canAnalyze = selectedVideoIds.length >= 1 && !!selectedAudioId;
  const canGenerate = beatTimes.length >= 2 && selectedVideoIds.length >= 1 && !!selectedAudioId;

  const toggleVideo = useCallback((id: string) => {
    setSelectedVideoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const analyzeBeats = useCallback(async () => {
    if (!selectedAudioAsset?.path) return;
    setAnalyzing(true);
    try {
      const times = await detectBeats(selectedAudioAsset.path, sensitivity);
      const bpm = estimateBpmFromTimes(times);
      setBeatTimes(times);
      setEstimatedBpm(bpm);
      setStep('preview');
      showToast({ kind: 'success', title: `检测到 ${times.length} 个节拍点，BPM ≈ ${bpm}` });
    } catch (err) {
      showToast({ kind: 'error', title: `节拍分析失败: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setAnalyzing(false);
    }
  }, [selectedAudioAsset, sensitivity]);

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;
    onGenerate({
      videoAssetIds: selectedVideoIds,
      audioAssetId: selectedAudioId,
      beatTimes,
      sensitivity,
    });
  }, [canGenerate, selectedVideoIds, selectedAudioId, beatTimes, sensitivity, onGenerate]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="AI 智能混剪"
      data-testid="smart-montage-dialog"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Wand2 size={18} className="text-brand" />
            <div>
              <h2 className="text-base font-semibold text-ink">AI 智能混剪</h2>
              <p className="text-xs text-slate-500">根据音乐节拍自动切割和排列视频片段</p>
            </div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
            type="button"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        {/* Step indicator */}
        <div className="flex items-center gap-1 border-b border-line px-4 py-2 text-xs">
          <StepBadge
            num={1}
            label="选择素材"
            active={step === 'select'}
            done={step === 'analyze' || step === 'preview'}
          />
          <ChevronRight size={12} className="text-slate-400" />
          <StepBadge num={2} label="分析节拍" active={step === 'analyze'} done={step === 'preview'} />
          <ChevronRight size={12} className="text-slate-400" />
          <StepBadge num={3} label="生成混剪" active={step === 'preview'} done={false} />
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {step === 'select' && (
            <div className="space-y-4">
              {/* Video assets */}
              <section>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Film size={14} />
                  视频素材 ({selectedVideoIds.length} 已选)
                </div>
                {videoAssets.length === 0 ? (
                  <div
                    className="rounded-md border border-dashed border-line p-6 text-center text-sm text-slate-500"
                    data-testid="smart-montage-empty-video"
                  >
                    暂无视频/图片素材，请先导入媒体
                  </div>
                ) : (
                  <div
                    className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto"
                    data-testid="smart-montage-video-list"
                  >
                    {videoAssets.map((asset) => {
                      const checked = selectedVideoIds.includes(asset.id);
                      return (
                        <label
                          key={asset.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors ${checked ? 'border-brand bg-brand/5 text-ink' : 'border-line bg-white text-slate-600 hover:bg-panel'}`}
                        >
                          <input
                            className="h-4 w-4 accent-brand"
                            type="checkbox"
                            checked={checked}
                            data-testid={`smart-montage-video-${asset.id}`}
                            onChange={() => toggleVideo(asset.id)}
                          />
                          <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-400">
                            {formatTimeShort(asset.duration)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Audio asset */}
              <section>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Music size={14} />
                  背景音乐
                </div>
                {audioAssets.length === 0 ? (
                  <div
                    className="rounded-md border border-dashed border-line p-6 text-center text-sm text-slate-500"
                    data-testid="smart-montage-empty-audio"
                  >
                    暂无音频素材，请先导入音乐文件
                  </div>
                ) : (
                  <div className="space-y-1" data-testid="smart-montage-audio-list">
                    {audioAssets.map((asset) => (
                      <label
                        key={asset.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors ${selectedAudioId === asset.id ? 'border-brand bg-brand/5 text-ink' : 'border-line bg-white text-slate-600 hover:bg-panel'}`}
                      >
                        <input
                          className="h-4 w-4 accent-brand"
                          type="radio"
                          name="bgm"
                          checked={selectedAudioId === asset.id}
                          data-testid={`smart-montage-audio-${asset.id}`}
                          onChange={() => setSelectedAudioId(asset.id)}
                        />
                        <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-400">
                          {formatTimeShort(asset.duration)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              {/* Sensitivity */}
              <section>
                <label className="block text-sm font-medium text-slate-700">
                  节拍灵敏度
                  <select
                    className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm"
                    value={sensitivity}
                    data-testid="smart-montage-sensitivity"
                    onChange={(e) => setSensitivity(e.target.value as BeatSensitivity)}
                  >
                    <option value="low">低 — 只检测强拍</option>
                    <option value="medium">中 — 推荐</option>
                    <option value="high">高 — 检测更多细节</option>
                  </select>
                </label>
              </section>
            </div>
          )}

          {step === 'analyze' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-brand" />
              <p className="mt-3 text-sm text-slate-600">正在分析音频节拍...</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3" data-testid="smart-montage-stats">
                <StatCard label="视频素材" value={`${selectedVideoIds.length}`} unit="个" />
                <StatCard label="检测节拍" value={`${beatTimes.length}`} unit="个" />
                <StatCard label="估算 BPM" value={`${estimatedBpm}`} unit="" />
              </div>
              <div className="rounded-md border border-line bg-panel p-3">
                <p className="text-xs text-slate-500">
                  系统将根据 {beatTimes.length} 个节拍点，把 {selectedVideoIds.length}{' '}
                  个视频素材按顺序循环排列到节拍间隔中， 生成 {Math.min(beatTimes.length - 1, beatTimes.length)}{' '}
                  个片段，并添加背景音乐轨道。
                </p>
              </div>
              {/* Beat timeline preview */}
              <div
                className="relative h-8 overflow-hidden rounded-md border border-line bg-slate-50"
                data-testid="smart-montage-beat-preview"
              >
                {beatTimes.slice(0, 50).map((time, i) => {
                  const totalDuration = beatTimes[beatTimes.length - 1] - beatTimes[0];
                  const left = totalDuration > 0 ? ((time - beatTimes[0]) / totalDuration) * 100 : 0;
                  return (
                    <div key={i} className="absolute top-0 h-full w-px bg-brand/40" style={{ left: `${left}%` }} />
                  );
                })}
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                  节拍分布预览
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-line px-4 py-3">
          <div>
            {step !== 'select' && (
              <button
                className="rounded-md border border-line px-3 py-1.5 text-sm text-slate-600 hover:bg-panel"
                type="button"
                onClick={() => {
                  setStep('select');
                  setBeatTimes([]);
                  setEstimatedBpm(0);
                }}
                data-testid="smart-montage-back-button"
              >
                返回修改
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-line px-3 py-1.5 text-sm text-slate-600 hover:bg-panel"
              type="button"
              onClick={onClose}
              data-testid="smart-montage-cancel-button"
            >
              取消
            </button>
            {step === 'select' && (
              <button
                className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
                type="button"
                disabled={!canAnalyze || analyzing}
                onClick={() => {
                  setStep('analyze');
                  void analyzeBeats();
                }}
                data-testid="smart-montage-analyze-button"
              >
                {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Music size={14} />}
                分析节拍
              </button>
            )}
            {step === 'preview' && (
              <button
                className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
                type="button"
                disabled={!canGenerate}
                onClick={handleGenerate}
                data-testid="smart-montage-generate-button"
              >
                <Wand2 size={14} />
                生成混剪
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function StepBadge({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-brand text-white' : done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
    >
      {done ? '✓' : num} {label}
    </span>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-3 text-center">
      <div className="text-lg font-bold text-ink">
        {value}
        <span className="ml-0.5 text-xs font-normal text-slate-500">{unit}</span>
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
