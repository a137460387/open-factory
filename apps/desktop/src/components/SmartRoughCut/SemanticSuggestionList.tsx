/**
 * M3-2 语义建议列表（只读呈现）
 *
 * 消费 M3-1 的 semanticSuggestions：label + timeRange + reason + confidence
 * 展示，climax 项视觉高亮；hover 联动 playhead（复用 M2 结果项 hover 模式：
 * onMouseEnter 携带区间起点，无 leave 回调）。speechUnderstanding.ready
 * 为 false 时入口禁用 + 提示文案（类比 Compare 依赖 contentAnalysis 的
 * 就绪信号门控模式）。只读呈现，不自动应用（应用整合属 M3-3 范围）。
 */
import { zhCN } from '../../i18n/strings';
import type { SemanticRoughCutSuggestion } from './semantic-suggestion';
import { formatSeconds } from './smart-rough-cut-utils';

export interface SemanticSuggestionListProps {
  /** M3-1 派生的语义粗剪建议（useSmartRoughCut().semanticSuggestions） */
  suggestions: SemanticRoughCutSuggestion[];
  /** 转写文本就绪信号（speechUnderstanding.ready） */
  ready: boolean;
  /** hover 联动 playhead 跳转（M2 同款模式） */
  onPreviewTime(time: number): void;
  /** 打开单条建议的对比审阅对话框（M3-3 A1 单条入口） */
  onReview(suggestion: SemanticRoughCutSuggestion): void;
}

export function SemanticSuggestionList({ suggestions, ready, onPreviewTime, onReview }: SemanticSuggestionListProps) {
  return (
    <section
      className="mb-3 rounded-md border border-line bg-white p-3"
      data-testid="smart-semantic"
      data-ready={ready ? 'true' : 'false'}
    >
      <h3 className="text-xs font-semibold text-ink">{zhCN.smartRoughCut.semanticTitle}</h3>
      {!ready ? (
        <p className="mt-1 text-xs leading-5 text-slate-500" data-testid="smart-semantic-hint">
          {zhCN.smartRoughCut.semanticNotReady}
        </p>
      ) : suggestions.length === 0 ? (
        <p className="mt-1 text-xs leading-5 text-slate-500" data-testid="smart-semantic-empty">
          {zhCN.smartRoughCut.semanticEmpty}
        </p>
      ) : (
        <div className="mt-2 max-h-40 space-y-1 overflow-auto" data-testid="smart-semantic-list">
          {suggestions.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded border p-2 ${
                item.markerType === 'climax' ? 'border-amber-400 bg-amber-50' : 'border-line bg-white'
              }`}
              data-testid={`smart-semantic-item-${item.id}`}
              data-climax={item.markerType === 'climax' ? 'true' : 'false'}
              data-source={item.source}
              onMouseEnter={() => onPreviewTime(item.timeRange.start)}
            >
              <span
                className={`flex-none rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  item.markerType === 'climax' ? 'bg-amber-500 text-white' : 'bg-panel text-slate-600'
                }`}
              >
                {item.label}
              </span>
              {item.source !== 'narrative' ? (
                <span
                  className="flex-none rounded border border-line px-1 py-0.5 text-[9px] text-slate-500"
                  data-testid={`smart-semantic-source-${item.id}`}
                >
                  {zhCN.smartRoughCut.semanticHeuristicTag}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 text-xs text-slate-700">
                <span className="block tabular-nums">
                  {zhCN.smartRoughCut.semanticRange(
                    formatSeconds(item.timeRange.start),
                    formatSeconds(item.timeRange.end),
                  )}
                </span>
                <span className="block text-[10px] text-slate-500">{item.reason}</span>
              </span>
              <span className="flex-none text-[10px] tabular-nums text-slate-500">
                {zhCN.smartRoughCut.semanticConfidence(item.confidence)}
              </span>
              <button
                type="button"
                className="flex-none rounded border border-line bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                data-testid={`smart-semantic-review-${item.id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onReview(item);
                }}
              >
                {zhCN.smartRoughCut.semanticReviewButton}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
