/**
 * 编排报告组件
 *
 * 展示素材分析、剪辑决策、时长统计的结构化报告。
 */
import type { SmartRoughCutReport, SmartRoughCutSuggestionType } from '@open-factory/editor-core';
import { round } from '@open-factory/editor-core';

const TYPE_LABELS: Record<SmartRoughCutSuggestionType, string> = {
  scene_split: '场景分割',
  silence_remove: '静音删除',
  subtitle_add: '字幕生成',
  dialogue_extract: '对话提取',
  broll_insert: 'B-roll 插入',
  rhythm_cut: '节奏剪辑',
  emotion_highlight: '情感高亮',
  narrative_structure: '叙事结构',
};

interface OrchestrationReportProps {
  report: SmartRoughCutReport;
}

export function OrchestrationReport({ report }: OrchestrationReportProps) {
  return (
    <div
      className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600"
      data-testid="orchestration-report"
    >
      <h3 className="mb-2 text-[11px] font-semibold text-slate-700">📊 剪辑报告</h3>

      {/* 素材分析概览 */}
      <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <ReportRow label="分析素材数" value={String(report.totalMediaAnalyzed)} />
        <ReportRow label="场景边界" value={String(report.sceneBoundaries)} />
        <ReportRow label="静音段" value={`${report.silenceRangesFound} 段`} />
        <ReportRow label="静音总时长" value={`${report.silenceDurationRemoved}s`} />
        <ReportRow label="字幕条数" value={String(report.subtitleCuesGenerated)} />
        <ReportRow label="对话区间" value={`${report.dialogueIntervalsFound} 段`} />
        <ReportRow label="对话总时长" value={`${report.dialogueDurationTotal}s`} />
        <ReportRow label="节拍数" value={`${report.beatCount}${report.estimatedBpm > 0 ? ` (${round(report.estimatedBpm)} BPM)` : ''}`} />
        <ReportRow label="情感峰值" value={String(report.emotionPeaks)} />
        <ReportRow label="叙事段落" value={String(report.narrativeActs)} />
      </div>

      {/* 建议统计 */}
      <div className="mb-2 border-t border-line pt-2">
        <div className="mb-1 text-[11px] font-medium text-slate-700">剪辑决策</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {(
            Object.entries(report.suggestionsByType) as Array<[SmartRoughCutSuggestionType, number]>
          )
            .filter(([, count]) => count > 0)
            .map(([type, count]) => (
              <ReportRow key={type} label={TYPE_LABELS[type] ?? type} value={`${count} 条`} />
            ))}
        </div>
      </div>

      {/* 汇总 */}
      <div className="border-t border-line pt-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700">建议总数</span>
          <span className="font-semibold text-ink">{report.totalSuggestions} 条</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-medium text-slate-700">已选中</span>
          <span className="font-semibold text-brand">{report.selectedSuggestions} 条</span>
        </div>
        {report.estimatedOutputDuration > 0 && (
          <div className="mt-1 flex items-center justify-between">
            <span className="font-medium text-slate-700">预估输出时长</span>
            <span className="font-semibold text-ink">{formatDuration(report.estimatedOutputDuration)}</span>
          </div>
        )}
      </div>

      {/* 生成时间 */}
      <div className="mt-2 text-[10px] text-slate-400">
        生成于 {new Date(report.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-slate-500">{label}</span>
      <span className="flex-none font-medium text-slate-700">{value}</span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = round(seconds % 60, 1);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
