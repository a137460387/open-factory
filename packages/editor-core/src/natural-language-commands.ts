/**
 * Natural Language Command System
 *
 * Parses natural language text commands into structured editor actions.
 * Supports both typed text and speech-to-text input.
 *
 * Command categories:
 * - Clip operations (cut, delete, duplicate, split)
 * - Timeline navigation (go to, skip, jump)
 * - Effect application (add effect, color grade)
 * - Playback control (play, pause, seek)
 * - Export operations
 */

import { round } from './time';

// ==================== Types ====================

export type CommandType =
  | 'cut'
  | 'delete'
  | 'duplicate'
  | 'split'
  | 'trim'
  | 'speed'
  | 'go-to'
  | 'skip-forward'
  | 'skip-backward'
  | 'play'
  | 'pause'
  | 'seek'
  | 'add-effect'
  | 'remove-effect'
  | 'color-grade'
  | 'add-transition'
  | 'volume'
  | 'mute'
  | 'unmute'
  | 'export'
  | 'undo'
  | 'redo'
  | 'select'
  | 'deselect'
  | 'zoom-in'
  | 'zoom-out'
  | 'unknown';

export interface ParsedCommand {
  /** Command type */
  type: CommandType;
  /** Extracted parameters */
  params: Record<string, string | number | undefined>;
  /** Confidence 0-1 */
  confidence: number;
  /** Original text */
  rawText: string;
  /** Time reference if any (seconds) */
  timeRef?: number;
  /** Clip reference if any */
  clipRef?: string;
}

export interface CommandPattern {
  /** Command type to match */
  type: CommandType;
  /** Regex patterns (any match triggers this command) */
  patterns: RegExp[];
  /** Parameter extractors (match, fullText) */
  extractors?: Array<(match: RegExpMatchArray, fullText: string) => Partial<Record<string, string | number>>>;
  /** Base confidence */
  confidence: number;
}

export interface CommandParserConfig {
  /** Language for parsing */
  language: 'zh' | 'en';
  /** Minimum confidence to accept */
  minConfidence: number;
  /** Default time unit interpretation */
  defaultTimeUnit: 'seconds' | 'frames';
}

export const DEFAULT_COMMAND_PARSER_CONFIG: CommandParserConfig = {
  language: 'zh',
  minConfidence: 0.3,
  defaultTimeUnit: 'seconds',
};

// ==================== Pattern Definitions ====================

const ZH_PATTERNS: CommandPattern[] = [
  {
    type: 'cut',
    patterns: [/剪切|切割|裁剪|切掉/i],
    confidence: 0.9,
  },
  {
    type: 'delete',
    patterns: [/删除|去掉|移除|干掉|不要了/i],
    confidence: 0.9,
  },
  {
    type: 'duplicate',
    patterns: [/复制|拷贝|再来一份|重复/i],
    confidence: 0.85,
  },
  {
    type: 'split',
    patterns: [/分割|拆分|从这里切|一分为二/i],
    confidence: 0.9,
  },
  {
    type: 'trim',
    patterns: [/裁剪|修剪|缩短|截取|掐头去尾/i],
    extractors: [(_m, text) => {
      const dur = extractDuration(text);
      return dur !== undefined ? { duration: dur } : {};
    }],
    confidence: 0.85,
  },
  {
    type: 'speed',
    patterns: [/加速|减速|倍速|速度|快进|慢放|(\d+(?:\.\d+)?)\s*倍/i],
    extractors: [(m, text) => {
      const speedMatch = text.match(/(\d+(?:\.\d+)?)\s*倍/);
      if (speedMatch) return { speed: parseFloat(speedMatch[1]) };
      if (/加速|快进/.test(text)) return { speed: 2 };
      if (/减速|慢放/.test(text)) return { speed: 0.5 };
      return {};
    }],
    confidence: 0.85,
  },
  {
    type: 'go-to',
    patterns: [/跳到|跳转|定位到|转到|去到|前往/i],
    extractors: [(_m, text) => {
      const time = extractTimeFromText(text);
      return time !== undefined ? { time } : {};
    }],
    confidence: 0.9,
  },
  {
    type: 'skip-forward',
    patterns: [/前进|往后跳|快进\s*(\d+)/i, /下一[个段秒]/i],
    extractors: [(_m, text) => {
      const dur = extractDuration(text);
      return dur !== undefined ? { seconds: dur } : { seconds: 5 };
    }],
    confidence: 0.8,
  },
  {
    type: 'skip-backward',
    patterns: [/后退|往前跳|倒退\s*(\d+)/i, /上一[个段秒]/i],
    extractors: [(_m, text) => {
      const dur = extractDuration(text);
      return dur !== undefined ? { seconds: dur } : { seconds: 5 };
    }],
    confidence: 0.8,
  },
  {
    type: 'play',
    patterns: [/播放|开始播|放一下|开始/i],
    confidence: 0.85,
  },
  {
    type: 'pause',
    patterns: [/暂停|停一下|停止播放|暂停播放/i],
    confidence: 0.9,
  },
  {
    type: 'seek',
    patterns: [/拖到|seek\s*到|定位/i],
    extractors: [(_m, text) => {
      const time = extractTimeFromText(text);
      return time !== undefined ? { time } : {};
    }],
    confidence: 0.8,
  },
  {
    type: 'add-effect',
    patterns: [/加[个一]效果|添加效果|加滤镜|加特效|应用效果/i],
    extractors: [(_m, text) => {
      const effectMatch = text.match(/(?:效果|滤镜|特效)[是为：:]?\s*(.+)/);
      return effectMatch ? { effect: effectMatch[1].trim() } : {};
    }],
    confidence: 0.8,
  },
  {
    type: 'remove-effect',
    patterns: [/去掉效果|移除效果|删除效果|取消滤镜/i],
    confidence: 0.85,
  },
  {
    type: 'color-grade',
    patterns: [/调色|校色|色彩调整|颜色/i],
    extractors: [(_m, text) => {
      const styleMatch = text.match(/(?:调|校|调整)[成到]?\s*(.+)/);
      return styleMatch ? { style: styleMatch[1].trim() } : {};
    }],
    confidence: 0.75,
  },
  {
    type: 'add-transition',
    patterns: [/加转场|添加过渡|加个过渡|转场效果/i],
    extractors: [(_m, text) => {
      const transMatch = text.match(/(?:转场|过渡)[是为：:]?\s*(.+)/);
      return transMatch ? { transition: transMatch[1].trim() } : {};
    }],
    confidence: 0.8,
  },
  {
    type: 'volume',
    patterns: [/音量|声音大[一]?点|声音小[一]?点|调高音量|调低音量|(\d+)\s*%?\s*音量/i],
    extractors: [(_m, text) => {
      const volMatch = text.match(/(\d+)\s*%?/);
      if (volMatch) return { volume: parseInt(volMatch[1], 10) };
      if (/大|高/.test(text)) return { volume: 80 };
      if (/小|低/.test(text)) return { volume: 30 };
      return {};
    }],
    confidence: 0.85,
  },
  {
    type: 'mute',
    patterns: [/静音|消音|关闭声音|不要声音/i],
    confidence: 0.9,
  },
  {
    type: 'unmute',
    patterns: [/取消静音|打开声音|恢复声音/i],
    confidence: 0.9,
  },
  {
    type: 'export',
    patterns: [/导出|渲染|输出|生成视频/i],
    confidence: 0.85,
  },
  {
    type: 'undo',
    patterns: [/撤销|回退|上一步|撤回/i],
    confidence: 0.9,
  },
  {
    type: 'redo',
    patterns: [/重做|恢复|下一步|反撤销/i],
    confidence: 0.9,
  },
  {
    type: 'select',
    patterns: [/选中|选择|选这个|选那个|选上/i],
    confidence: 0.8,
  },
  {
    type: 'deselect',
    patterns: [/取消选择|取消选中|不选了/i],
    confidence: 0.85,
  },
  {
    type: 'zoom-in',
    patterns: [/放大|拉近|看清楚|细节/i],
    confidence: 0.75,
  },
  {
    type: 'zoom-out',
    patterns: [/缩小|拉远|看全局|总览/i],
    confidence: 0.75,
  },
];

const EN_PATTERNS: CommandPattern[] = [
  {
    type: 'cut',
    patterns: [/\bcut\b/i, /\btrim\b/i, /\bcrop\b/i],
    confidence: 0.9,
  },
  {
    type: 'delete',
    patterns: [/\bdelete\b/i, /\bremove\b/i, /\bdrop\b/i],
    confidence: 0.9,
  },
  {
    type: 'duplicate',
    patterns: [/\bduplicate\b/i, /\bcopy\b/i, /\bclone\b/i],
    confidence: 0.85,
  },
  {
    type: 'split',
    patterns: [/\bsplit\b/i, /\bslice\b/i, /\bbreak\b/i],
    confidence: 0.9,
  },
  {
    type: 'speed',
    patterns: [/\bspeed\s*(?:up|down)?\s*(\d+(?:\.\d+)?)x?/i, /(\d+(?:\.\d+)?)\s*x\s*speed/i],
    extractors: [(m, text) => {
      const speedMatch = text.match(/(\d+(?:\.\d+)?)\s*x?/i);
      if (speedMatch) return { speed: parseFloat(speedMatch[1]) };
      if (/up/i.test(text)) return { speed: 2 };
      if (/down/i.test(text)) return { speed: 0.5 };
      return {};
    }],
    confidence: 0.85,
  },
  {
    type: 'go-to',
    patterns: [/\bgo\s+to\b/i, /\bjump\s+to\b/i, /\bseek\s+to\b/i],
    extractors: [(_m, text) => {
      const time = extractTimeFromText(text);
      return time !== undefined ? { time } : {};
    }],
    confidence: 0.9,
  },
  {
    type: 'skip-forward',
    patterns: [/\bskip\s+forward\b/i, /\bforward\s+(\d+)/i],
    extractors: [(_m, text) => {
      const dur = extractDuration(text);
      return dur !== undefined ? { seconds: dur } : { seconds: 5 };
    }],
    confidence: 0.8,
  },
  {
    type: 'skip-backward',
    patterns: [/\bskip\s+back\b/i, /\bbackward\s+(\d+)/i],
    extractors: [(_m, text) => {
      const dur = extractDuration(text);
      return dur !== undefined ? { seconds: dur } : { seconds: 5 };
    }],
    confidence: 0.8,
  },
  {
    type: 'play',
    patterns: [/\bplay\b/i, /\bstart\b/i],
    confidence: 0.85,
  },
  {
    type: 'pause',
    patterns: [/\bpause\b/i, /\bstop\b/i],
    confidence: 0.9,
  },
  {
    type: 'add-effect',
    patterns: [/\badd\s+effect\b/i, /\bapply\s+effect\b/i],
    extractors: [(_m, text) => {
      const effectMatch = text.match(/effect\s+(.+)/i);
      return effectMatch ? { effect: effectMatch[1].trim() } : {};
    }],
    confidence: 0.8,
  },
  {
    type: 'volume',
    patterns: [/\bvolume\s+(\d+)/i, /\bset\s+volume\b/i],
    extractors: [(_m, text) => {
      const volMatch = text.match(/(\d+)/);
      return volMatch ? { volume: parseInt(volMatch[1], 10) } : {};
    }],
    confidence: 0.85,
  },
  {
    type: 'mute',
    patterns: [/\bmute\b/i],
    confidence: 0.9,
  },
  {
    type: 'unmute',
    patterns: [/\bunmute\b/i],
    confidence: 0.9,
  },
  {
    type: 'export',
    patterns: [/\bexport\b/i, /\brender\b/i],
    confidence: 0.85,
  },
  {
    type: 'undo',
    patterns: [/\bundo\b/i],
    confidence: 0.9,
  },
  {
    type: 'redo',
    patterns: [/\bredo\b/i],
    confidence: 0.9,
  },
  {
    type: 'zoom-in',
    patterns: [/\bzoom\s+in\b/i],
    confidence: 0.85,
  },
  {
    type: 'zoom-out',
    patterns: [/\bzoom\s+out\b/i],
    confidence: 0.85,
  },
];

// ==================== Utility Functions ====================

/**
 * Extract duration in seconds from text.
 * Supports: "3秒", "3s", "3 seconds", "三秒"
 */
function extractDuration(text: string): number | undefined {
  const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:秒|s|seconds?)/i);
  if (numMatch) return parseFloat(numMatch[1]);

  const cnNumMap: Record<string, number> = {
    '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  };
  const cnMatch = text.match(/([一二两三四五六七八九十])\s*秒/);
  if (cnMatch && cnNumMap[cnMatch[1]]) return cnNumMap[cnMatch[1]];

  return undefined;
}

/**
 * Extract timecode from text.
 * Supports: "1:30", "01:30:00", "90秒", "90s"
 */
function extractTimeFromText(text: string): number | undefined {
  // Timecode format: HH:MM:SS or MM:SS
  const tcMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (tcMatch) {
    const hours = tcMatch[3] ? parseInt(tcMatch[1], 10) : 0;
    const minutes = tcMatch[3] ? parseInt(tcMatch[2], 10) : parseInt(tcMatch[1], 10);
    const seconds = tcMatch[3] ? parseInt(tcMatch[3], 10) : parseInt(tcMatch[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Seconds format
  return extractDuration(text);
}

// ==================== Parser ====================

/**
 * Parse a natural language command text into structured commands.
 */
export function parseCommand(
  text: string,
  config: Partial<CommandParserConfig> = {},
): ParsedCommand {
  const cfg = { ...DEFAULT_COMMAND_PARSER_CONFIG, ...config };
  const trimmed = text.trim();
  if (!trimmed) {
    return { type: 'unknown', params: {}, confidence: 0, rawText: text };
  }

  const patterns = cfg.language === 'zh' ? ZH_PATTERNS : EN_PATTERNS;
  let bestMatch: ParsedCommand | null = null;

  for (const pattern of patterns) {
    for (const regex of pattern.patterns) {
      const match = trimmed.match(regex);
      if (match) {
        let params: Record<string, string | number | undefined> = {};
        if (pattern.extractors) {
          for (const extractor of pattern.extractors) {
            params = { ...params, ...extractor(match, trimmed) };
          }
        }

        const timeRef = params.time as number | undefined;

        const cmd: ParsedCommand = {
          type: pattern.type,
          params,
          confidence: pattern.confidence,
          rawText: text,
          timeRef,
        };

        if (!bestMatch || cmd.confidence > bestMatch.confidence) {
          bestMatch = cmd;
        }
      }
    }
  }

  if (bestMatch && bestMatch.confidence >= cfg.minConfidence) {
    return bestMatch;
  }

  return { type: 'unknown', params: {}, confidence: 0, rawText: text };
}

/**
 * Parse multiple commands from a single text (split by common delimiters).
 */
export function parseMultipleCommands(
  text: string,
  config: Partial<CommandParserConfig> = {},
): ParsedCommand[] {
  // Split by common delimiters: 然后, 接着, 再, and, then, also
  const delimiters = /(?:然后|接着|再|并且|，|。|;|;|,\s*then|,\s*also|\bthen\b|\band\b\s+then)/i;
  const parts = text.split(delimiters).map((p) => p.trim()).filter(Boolean);
  return parts.map((part) => parseCommand(part, config));
}

/**
 * Build a speech recognition grammar hint for the command palette.
 */
export function buildSpeechGrammarHints(language: 'zh' | 'en'): string[] {
  const zhHints = [
    '剪切', '删除', '复制', '分割', '播放', '暂停', '前进', '后退',
    '撤销', '重做', '导出', '静音', '音量', '放大', '缩小',
    '加效果', '加转场', '调色', '跳到', '选中',
  ];
  const enHints = [
    'cut', 'delete', 'copy', 'split', 'play', 'pause', 'forward', 'backward',
    'undo', 'redo', 'export', 'mute', 'volume', 'zoom in', 'zoom out',
    'add effect', 'add transition', 'go to', 'select',
  ];
  return language === 'zh' ? zhHints : enHints;
}

/**
 * Check if a command needs a target (clip, time, etc.)
 */
export function commandNeedsTarget(type: CommandType): boolean {
  const needsTarget: CommandType[] = [
    'cut', 'delete', 'duplicate', 'split', 'trim', 'speed',
    'add-effect', 'remove-effect', 'color-grade', 'add-transition',
    'volume', 'mute', 'unmute', 'select',
  ];
  return needsTarget.includes(type);
}
