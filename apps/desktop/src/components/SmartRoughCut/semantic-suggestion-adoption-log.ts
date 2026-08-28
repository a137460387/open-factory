/**
 * M3 扩展·首实施：语义建议采纳记录器（纯本地，零上报）
 *
 * 事件式追加记录：每次显式采纳成功（applySemanticSuggestion 成功分支）
 * 追加 {source, ts} 条目至 localStorage（键名沿用 open-factory:* 惯例），
 * 封顶 500 条截旧。隐私边界：纯本地数据，不上传任何远端服务、不进入
 * 项目持久化 schema；用途 = 后续可按任意口径（来源类型/时间窗）聚合，
 * 作为建议质量与后续拓展方向（如情感高潮 top-K 闸门）的长期候选信号。
 */
import type { SemanticSuggestionSource } from './semantic-suggestion';

const ADOPTION_LOG_KEY = 'open-factory:semantic-suggestion-adoptions';
const ADOPTION_LOG_CAP = 500;

/** 采纳事件条目：source = 建议来源；ts = 事件时间戳（毫秒） */
export interface SuggestionAdoptionEntry {
  source: SemanticSuggestionSource;
  ts: number;
}

const VALID_SOURCES: ReadonlySet<string> = new Set(['narrative', 'head-trim', 'tail-trim', 'emotional-climax']);

/** 记录一次采纳事件（写入失败静默忽略，不阻断采纳主流程） */
export function recordSuggestionAdoption(source: SemanticSuggestionSource, timestamp: number = Date.now()): void {
  try {
    const entries = [...readEntries(), { source, ts: timestamp }];
    writeEntries(entries.slice(-ADOPTION_LOG_CAP));
  } catch {
    // localStorage 不可用/超限：本地计数属尽力而为，失败不影响采纳
  }
}

/** 读取全部采纳事件（解析失败/损坏数据 → 空数组起点重新累计） */
export function getSuggestionAdoptions(): SuggestionAdoptionEntry[] {
  return readEntries();
}

/**
 * 按来源类型聚合采纳计数。
 *
 * @param options.sinceTs 时间窗起点（毫秒，含）：仅统计该时刻之后的条目
 * @returns source → 计数（未出现的来源不产出键）
 */
export function aggregateSuggestionAdoptions(options: { sinceTs?: number } = {}): Record<string, number> {
  const sinceTs = options.sinceTs ?? 0;
  const counts: Record<string, number> = {};
  for (const entry of readEntries()) {
    if (entry.ts >= sinceTs) {
      counts[entry.source] = (counts[entry.source] ?? 0) + 1;
    }
  }
  return counts;
}

function readEntries(): SuggestionAdoptionEntry[] {
  try {
    const raw = localStorage.getItem(ADOPTION_LOG_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is SuggestionAdoptionEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        VALID_SOURCES.has((entry as SuggestionAdoptionEntry).source) &&
        typeof (entry as SuggestionAdoptionEntry).ts === 'number' &&
        Number.isFinite((entry as SuggestionAdoptionEntry).ts),
    );
  } catch {
    return [];
  }
}

function writeEntries(entries: SuggestionAdoptionEntry[]): void {
  localStorage.setItem(ADOPTION_LOG_KEY, JSON.stringify(entries));
}
