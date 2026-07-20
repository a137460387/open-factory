import { useState, useCallback, useMemo } from 'react';
import type {
  EditTemplate,
  AnalysisReport,
  AutoEditResult,
  AutoEditProgress,
  AutoEditorConfig,
} from '@open-factory/editor-core';
import { TemplateManager, BUILTIN_EDIT_TEMPLATES, createDefaultAutoEditorConfig } from '@open-factory/editor-core';
import { Wand2, Play, ChevronDown, CheckCircle, Loader2, Film, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { useAutomationWorker } from '../../hooks/useAutomationWorker';

/* ------------------------------------------------------------------ */
/*  一键生成面板                                                        */
/* ------------------------------------------------------------------ */

interface AutoGeneratePanelProps {
  className?: string;
  /** 已有的分析报告（可选，如未提供则提示用户先分析） */
  analysisReport?: AnalysisReport | null;
  /** 生成结果回调 */
  onGenerated?: (result: AutoEditResult) => void;
}

export function AutoGeneratePanel({ className, analysisReport, onGenerated }: AutoGeneratePanelProps) {
  const [templateManager] = useState(() => new TemplateManager());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(BUILTIN_EDIT_TEMPLATES[0]?.id ?? '');
  const [config, setConfig] = useState<Partial<AutoEditorConfig>>(createDefaultAutoEditorConfig());
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<AutoEditProgress | null>(null);
  const [result, setResult] = useState<AutoEditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 使用 Worker hook 执行自动剪辑，避免阻塞 UI 线程
  const { ready: workerReady, error: workerError, autoEditInWorker } = useAutomationWorker();

  const allTemplates = useMemo(() => templateManager.getAllTemplates(), [templateManager]);
  const selectedTemplate = useMemo(
    () => templateManager.getTemplate(selectedTemplateId),
    [templateManager, selectedTemplateId],
  );

  const handleGenerate = useCallback(async () => {
    if (!analysisReport) {
      setError('请先分析素材再执行自动剪辑');
      return;
    }
    if (!selectedTemplate) {
      setError('请选择一个编辑模板');
      return;
    }
    if (!workerReady) {
      setError(workerError ?? 'Worker 尚未就绪，请稍后重试');
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);
    setProgress({ phase: 'filtering', progress: 0.1, message: '正在筛选素材...' });

    try {
      // 通过 Worker 执行自动剪辑，不阻塞 UI 线程
      setProgress({ phase: 'scoring', progress: 0.3, message: 'Worker 正在评分排序...' });

      const editResult = (await autoEditInWorker({
        report: analysisReport,
        templateId: selectedTemplate.id,
        config,
      })) as AutoEditResult;

      setProgress({ phase: 'generating', progress: 0.9, message: '正在生成时间线...' });

      setResult(editResult);
      setProgress({ phase: 'complete', progress: 1, message: '生成完成' });
      onGenerated?.(editResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  }, [analysisReport, selectedTemplate, config, workerReady, workerError, autoEditInWorker, onGenerated]);

  const handleReset = useCallback(() => {
    setResult(null);
    setProgress(null);
    setError(null);
  }, []);

  return (
    <div className={cn('flex flex-col h-full', className)} data-testid="auto-generate-panel">
      {/* 标题 */}
      <div className="px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold">一键生成</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">从素材分析结果自动生成粗剪时间线（Worker 线程执行）</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 素材分析状态 */}
        <div className="flex items-center gap-2 p-3 rounded-md border border-line" data-testid="analysis-status">
          {analysisReport ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">已分析 {analysisReport.scenes.length} 个场景</p>
                <p className="text-xs text-muted-foreground">
                  {analysisReport.mediaPaths.length} 个素材文件 · 总时长 {analysisReport.stats.totalDuration.toFixed(1)}
                  s
                </p>
              </div>
            </>
          ) : (
            <>
              <Film className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">尚未分析素材</p>
                <p className="text-xs text-muted-foreground">请先在"分析"标签页中分析素材</p>
              </div>
            </>
          )}
        </div>

        {/* 模板选择 */}
        <div>
          <Label className="text-xs font-medium mb-1.5 block">编辑模板</Label>
          <div className="relative">
            <select
              className="w-full h-9 px-3 pr-8 text-sm rounded-md border border-line bg-background appearance-none cursor-pointer"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              data-testid="template-select"
            >
              {allTemplates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} {tpl.builtin ? '(内置)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>

          {/* 模板预览 */}
          {selectedTemplate && (
            <div className="mt-2 p-2 rounded bg-muted/50 text-xs space-y-1" data-testid="template-preview">
              <p>{selectedTemplate.description}</p>
              <div className="flex gap-3 text-muted-foreground">
                <span>节奏: {selectedTemplate.rhythm.style}</span>
                <span>
                  片段: {selectedTemplate.rhythm.clipDurationRange.min}-{selectedTemplate.rhythm.clipDurationRange.max}s
                </span>
                {selectedTemplate.rhythm.beatSync && <span>🎵 卡点</span>}
              </div>
            </div>
          )}
        </div>

        {/* 高级配置 */}
        <div>
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowAdvanced(!showAdvanced)}
            data-testid="toggle-advanced"
          >
            <Settings2 className="w-3 h-3" />
            高级配置
            <ChevronDown className={cn('w-3 h-3 transition-transform', showAdvanced && 'rotate-180')} />
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-3 pl-4 border-l-2 border-line" data-testid="advanced-config">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="beat-sync"
                  checked={config.enableBeatSync ?? false}
                  onChange={(e) => setConfig((c) => ({ ...c, enableBeatSync: e.target.checked }))}
                  className="rounded"
                  data-testid="beat-sync-checkbox"
                />
                <Label htmlFor="beat-sync" className="text-xs">
                  启用 BPM 卡点
                </Label>
              </div>

              {config.enableBeatSync && (
                <div>
                  <Label className="text-xs">自定义 BPM</Label>
                  <input
                    type="number"
                    min={60}
                    max={200}
                    value={config.customBpm ?? ''}
                    placeholder="自动检测"
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, customBpm: e.target.value ? Number(e.target.value) : undefined }))
                    }
                    className="w-24 h-7 px-2 text-xs rounded border border-line bg-background ml-2"
                    data-testid="custom-bpm-input"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">最大总时长（秒，0=不限制）</Label>
                <input
                  type="number"
                  min={0}
                  value={config.maxTotalDuration ?? 0}
                  onChange={(e) => setConfig((c) => ({ ...c, maxTotalDuration: Number(e.target.value) }))}
                  className="w-24 h-7 px-2 text-xs rounded border border-line bg-background ml-2"
                  data-testid="max-duration-input"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="shuffle"
                  checked={config.shuffleMedia ?? false}
                  onChange={(e) => setConfig((c) => ({ ...c, shuffleMedia: e.target.checked }))}
                  className="rounded"
                  data-testid="shuffle-checkbox"
                />
                <Label htmlFor="shuffle" className="text-xs">
                  随机排列素材
                </Label>
              </div>
            </div>
          )}
        </div>

        {/* Worker 状态 */}
        {!workerReady && !workerError && (
          <div className="p-2 rounded bg-yellow-50 text-yellow-600 text-xs flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Worker 初始化中...
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="p-2 rounded bg-red-50 text-red-600 text-xs" data-testid="error-message">
            {error}
          </div>
        )}

        {/* 进度 */}
        {progress && progress.phase !== 'complete' && (
          <div className="space-y-2" data-testid="generation-progress">
            <div className="flex items-center gap-2 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{progress.message}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress.progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 结果预览 */}
        {result && (
          <div
            className="p-3 rounded-md border border-green-200 bg-green-50/50 space-y-2"
            data-testid="auto-generate-result"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-700">生成完成</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">片段数</span>
                <span className="ml-1 font-medium" data-testid="result-clip-count">
                  {result.generatedClips.length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">转场数</span>
                <span className="ml-1 font-medium" data-testid="result-transition-count">
                  {result.generatedTransitions.length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">总时长</span>
                <span className="ml-1 font-medium" data-testid="result-duration">
                  {result.totalDuration.toFixed(1)}s
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">轨道</span>
                <span className="ml-1 font-mono text-[10px]">{result.trackId.slice(0, 12)}...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="px-4 py-3 border-t border-line flex gap-2">
        {result ? (
          <>
            <Button variant="outline" size="sm" className="flex-1" onClick={handleReset} data-testid="regenerate-btn">
              重新生成
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onGenerated?.(result)}
              data-testid="apply-to-timeline-btn"
            >
              应用到时间线
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="flex-1"
            onClick={handleGenerate}
            disabled={generating || !analysisReport || !workerReady}
            data-testid="auto-generate-btn"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-1" />
                一键生成
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
