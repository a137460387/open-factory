export type ErrorCategory =
  | 'codec'
  | 'path'
  | 'disk'
  | 'font'
  | 'permission'
  | 'network'
  | 'memory'
  | 'ffmpeg-version'
  | 'input-format'
  | 'output-format'
  | 'hardware'
  | 'timeout'
  | 'subtitles'
  | 'audio'
  | 'general';

export interface ErrorKnowledgeEntry {
  id: string;
  category: ErrorCategory;
  patterns: string[];
  label: string;
  causes: string[];
  solutions: string[];
  links: string[];
  baseWeight: number;
}

export interface ErrorKnowledgeMatch {
  entry: ErrorKnowledgeEntry;
  score: number;
  matchedPatterns: string[];
}

export interface ErrorFeedbackRecord {
  entryId: string;
  helpful: boolean;
  timestamp: number;
}

export interface ErrorKnowledgeStore {
  version: number;
  entries: ErrorKnowledgeEntry[];
  feedback: ErrorFeedbackRecord[];
  lastUpdatedAt: number;
  updateSource?: string;
}

const FEEDBACK_WEIGHT_HELPFUL = 0.3;
const FEEDBACK_WEIGHT_UNHELPFUL = -0.15;
const FEEDBACK_DECAY_DAYS = 90;
const FEEDBACK_WINDOW_ENTRIES = 50;

export const BUILT_IN_ERROR_ENTRIES: ErrorKnowledgeEntry[] = [
  {
    id: 'codec-unsupported',
    category: 'codec',
    patterns: ['Unknown encoder', 'Unknown decoder', 'codec not supported', 'not compatible with', 'Encoder not found'],
    label: '编解码器不支持',
    causes: ['导出预设中使用了系统未安装的编解码器', '硬件加速编码器不可用', 'FFmpeg 版本不包含所需编解码器'],
    solutions: ['切换为 libx264/libx265 等软件编码器', '安装对应硬件驱动（如 NVIDIA NVENC）', '升级 FFmpeg 到最新版本'],
    links: ['https://github.com/open-factory/open-factory/wiki/export-codec-guide'],
    baseWeight: 1.0,
  },
  {
    id: 'codec-profile-level',
    category: 'codec',
    patterns: ['profile.*not supported', 'level.*not supported', 'incompatible profile', 'codec.*profile.*error'],
    label: '编解码器配置不兼容',
    causes: ['选择了设备不支持的编码 Profile 或 Level', '硬件编码器对 Profile 有限制'],
    solutions: ['将编码 Profile 从 High 降为 Main 或 Baseline', '降低编码 Level 设置', '改用软件编码器'],
    links: ['https://github.com/open-factory/open-factory/wiki/export-codec-guide'],
    baseWeight: 0.85,
  },
  {
    id: 'path-invalid',
    category: 'path',
    patterns: [
      'No such file or directory',
      'invalid argument',
      'path.*invalid',
      'special character',
      'is not recognized',
    ],
    label: '输出路径异常',
    causes: ['输出路径包含中文、空格或特殊符号', '目标目录不存在', '路径长度超出系统限制'],
    solutions: ['使用纯英文、无空格的输出路径', '确认目标目录已存在', '缩短文件路径至 260 字符以内'],
    links: ['https://github.com/open-factory/open-factory/wiki/export-troubleshooting'],
    baseWeight: 0.95,
  },
  {
    id: 'path-readonly',
    category: 'path',
    patterns: ['Read-only file system', 'EROFS', 'read-only'],
    label: '输出路径为只读',
    causes: ['输出目录位于只读文件系统（如 CD-ROM、写保护分区）', '网络映射驱动器权限不足'],
    solutions: ['选择可写入的本地磁盘作为输出目录', '检查网络驱动器的写入权限'],
    links: ['https://github.com/open-factory/open-factory/wiki/export-troubleshooting'],
    baseWeight: 0.9,
  },
  {
    id: 'disk-space',
    category: 'disk',
    patterns: ['No space left', 'disk full', 'not enough space', 'ENOSPC'],
    label: '磁盘空间不足',
    causes: ['输出分区剩余空间不足以容纳导出文件', '临时目录所在分区空间不足'],
    solutions: [
      '清理磁盘空间或将输出目录改到其他分区',
      '降低导出码率或分辨率以减小文件体积',
      '清除应用缓存释放临时空间',
    ],
    links: ['https://github.com/open-factory/open-factory/wiki/export-troubleshooting'],
    baseWeight: 1.0,
  },
  {
    id: 'disk-io-error',
    category: 'disk',
    patterns: ['I/O error', 'EIO', 'Input/output error', 'disk I/O'],
    label: '磁盘 I/O 错误',
    causes: ['磁盘硬件故障', 'USB 设备连接不稳定', '磁盘即将损坏'],
    solutions: ['更换存储设备', '检查磁盘健康状态（SMART 数据）', '避免使用 USB Hub 连接外部存储'],
    links: [],
    baseWeight: 0.95,
  },
  {
    id: 'font-missing',
    category: 'font',
    patterns: ['font.*not found', 'Fontconfig', 'glyph.*not found', 'cannot render.*font', 'font.*missing'],
    label: '字体缺失',
    causes: ['drawtext 滤镜引用了未安装的字体', '系统缺少 fontconfig 或字体缓存未更新', '字体文件路径不正确'],
    solutions: [
      '安装所需字体到系统字体目录',
      '运行 fc-cache -fv 更新字体缓存',
      '使用系统已安装的通用字体（如 Arial、Noto Sans）',
    ],
    links: ['https://github.com/open-factory/open-factory/wiki/subtitle-font-guide'],
    baseWeight: 0.9,
  },
  {
    id: 'fontconfig-dependency',
    category: 'font',
    patterns: ['fontconfig', 'cannot open shared object.*libfontconfig', 'FcInit'],
    label: 'fontconfig 依赖缺失',
    causes: ['系统未安装 fontconfig 库', 'FFmpeg 编译时未链接 fontconfig'],
    solutions: [
      '安装 fontconfig（Linux: apt install fontconfig，Windows: 安装 MSYS2 fontconfig）',
      '使用包含 fontconfig 的 FFmpeg 构建版本',
    ],
    links: ['https://github.com/open-factory/open-factory/wiki/subtitle-font-guide'],
    baseWeight: 0.88,
  },
  {
    id: 'permission-denied',
    category: 'permission',
    patterns: ['Permission denied', 'access denied', 'EACCES'],
    label: '权限不足',
    causes: ['没有写入目标文件的权限', '文件被其他程序占用', '需要管理员权限'],
    solutions: ['检查输出目录的文件权限', '关闭可能占用文件的程序', '以管理员身份运行应用'],
    links: ['https://github.com/open-factory/open-factory/wiki/export-troubleshooting'],
    baseWeight: 0.95,
  },
  {
    id: 'network-unreachable',
    category: 'network',
    patterns: ['Network is unreachable', 'ENETUNREACH', 'Connection refused', 'No route to host'],
    label: '网络存储不可达',
    causes: ['NAS 或网络驱动器连接断开', '网络配置变更导致 SMB/NFS 路径失效', 'VPN 断开导致网络路径不可达'],
    solutions: ['检查网络连接和 NAS 设备状态', '重新映射网络驱动器', '将媒体和输出路径改为本地磁盘'],
    links: [],
    baseWeight: 0.85,
  },
  {
    id: 'network-timeout',
    category: 'network',
    patterns: ['Connection timed out', 'ETIMEDOUT', 'network.*timeout'],
    label: '网络超时',
    causes: ['网络存储响应过慢', '大文件传输时网络不稳定'],
    solutions: ['检查网络带宽和稳定性', '将文件先复制到本地磁盘再进行导出', '减少同时进行的网络操作'],
    links: [],
    baseWeight: 0.8,
  },
  {
    id: 'memory-oom',
    category: 'memory',
    patterns: ['Cannot allocate memory', 'ENOMEM', 'out of memory', 'OOM', 'memory allocation failed'],
    label: '内存不足',
    causes: ['系统可用内存不足', '导出分辨率过高导致内存需求超出系统限制', '同时运行了过多占用内存的程序'],
    solutions: ['关闭其他占用内存的应用', '降低导出分辨率或使用分段导出', '增加系统虚拟内存（页面文件）大小'],
    links: ['https://github.com/open-factory/open-factory/wiki/performance-guide'],
    baseWeight: 0.95,
  },
  {
    id: 'ffmpeg-version-incompatible',
    category: 'ffmpeg-version',
    patterns: ['option.*not found', 'Unrecognized option', 'Invalid argument.*option', 'Unknown option'],
    label: 'FFmpeg 版本不兼容',
    causes: ['当前 FFmpeg 版本过旧，不支持所用参数', 'FFmpeg 版本过新，某些参数语法已变更'],
    solutions: [
      '升级 FFmpeg 到 6.0 或更高版本',
      '检查导出预设中的高级参数是否与当前版本兼容',
      '重置导出预设为默认参数',
    ],
    links: ['https://github.com/open-factory/open-factory/wiki/ffmpeg-compatibility'],
    baseWeight: 0.85,
  },
  {
    id: 'ffmpeg-corrupt-input',
    category: 'input-format',
    patterns: ['Invalid data found', 'corrupt', 'truncated', 'broken', 'moov atom not found'],
    label: '源文件损坏',
    causes: ['输入媒体文件下载不完整或已损坏', '视频文件缺少 moov atom（MP4 未完整封装）', '文件传输过程中数据丢失'],
    solutions: [
      '尝试重新导入或用其他工具修复源文件',
      '使用 FFmpeg 重新封装：ffmpeg -i input.mp4 -c copy output.mp4',
      '从原始来源重新获取媒体文件',
    ],
    links: ['https://github.com/open-factory/open-factory/wiki/media-repair'],
    baseWeight: 0.9,
  },
  {
    id: 'output-format-incompatible',
    category: 'output-format',
    patterns: ['muxer.*does not support', 'format.*not supported', 'container.*not compatible', 'could not find tag'],
    label: '输出格式不兼容',
    causes: ['所选输出容器不支持当前编解码器组合', '字幕格式与容器不兼容', '某些流类型不被目标容器支持'],
    solutions: ['更换输出容器格式（如 MKV 替代 MP4）', '调整编码器使其与容器兼容', '移除不兼容的流（如特定字幕轨）'],
    links: ['https://github.com/open-factory/open-factory/wiki/export-format-guide'],
    baseWeight: 0.88,
  },
  {
    id: 'hardware-accel-fail',
    category: 'hardware',
    patterns: ['CUDA', 'NVENC.*error', 'hwaccel', 'device.*not found', 'GPU.*error', 'hardware.*encode.*fail'],
    label: '硬件加速失败',
    causes: ['GPU 驱动版本过旧', 'GPU 不支持所请求的编码功能', 'GPU 被其他进程占用'],
    solutions: ['更新 GPU 驱动到最新版本', '切换为软件编码（如 libx264）', '关闭其他使用 GPU 的应用'],
    links: ['https://github.com/open-factory/open-factory/wiki/hardware-acceleration'],
    baseWeight: 0.9,
  },
  {
    id: 'export-timeout',
    category: 'timeout',
    patterns: ['timed out', 'timeout', 'killed.*signal', 'process.*terminated', 'abort'],
    label: '导出超时或被终止',
    causes: ['导出时间过长被系统或应用终止', '系统进入休眠导致进程中断', '系统内存不足触发 OOM Killer'],
    solutions: ['检查系统电源管理设置，防止休眠', '降低导出复杂度（分辨率、滤镜）', '分段导出长视频'],
    links: [],
    baseWeight: 0.85,
  },
  {
    id: 'subtitle-render-error',
    category: 'subtitles',
    patterns: ['drawtext.*error', 'subtitle.*render', 'ass.*parse.*error', 'SSA.*error', 'subtitle.*format.*error'],
    label: '字幕渲染失败',
    causes: ['字幕文件格式错误或编码不正确', 'ASS/SSA 字幕样式参数异常', 'drawtext 滤镜参数格式错误'],
    solutions: ['检查字幕文件编码（建议 UTF-8）', '简化字幕样式参数', '使用 SRT 格式替代 ASS 格式'],
    links: ['https://github.com/open-factory/open-factory/wiki/subtitle-troubleshooting'],
    baseWeight: 0.85,
  },
  {
    id: 'audio-encode-error',
    category: 'audio',
    patterns: [
      'audio.*encode.*error',
      'sample rate.*not supported',
      'channel.*layout.*not supported',
      'audio.*bitrate',
    ],
    label: '音频编码错误',
    causes: ['音频采样率或声道布局与编码器不兼容', '音频比特率设置超出编码器限制', '音频源数据损坏'],
    solutions: ['将音频采样率设置为 44100Hz 或 48000Hz', '使用标准声道布局（立体声/单声道）', '降低音频比特率设置'],
    links: [],
    baseWeight: 0.82,
  },
];

export function matchErrorKnowledge(
  stderr: string,
  entries: ErrorKnowledgeEntry[],
  feedbackMap?: Map<string, number>,
): ErrorKnowledgeMatch[] {
  if (!stderr || !entries.length) {
    return [];
  }
  const matches: ErrorKnowledgeMatch[] = [];
  for (const entry of entries) {
    const matchedPatterns: string[] = [];
    let patternHits = 0;
    for (const pattern of entry.patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(stderr)) {
        matchedPatterns.push(pattern);
        patternHits += 1;
      }
    }
    if (patternHits === 0) {
      continue;
    }
    const patternRatio = patternHits / entry.patterns.length;
    const feedbackBonus = feedbackMap ? calculateFeedbackBonus(entry.id, feedbackMap) : 0;
    const score = roundScore(entry.baseWeight * (0.6 + 0.4 * patternRatio) + feedbackBonus);
    matches.push({ entry, score, matchedPatterns });
  }
  return matches.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
}

export function getTopMatches(
  stderr: string,
  entries: ErrorKnowledgeEntry[],
  feedbackMap?: Map<string, number>,
  limit = 3,
): ErrorKnowledgeMatch[] {
  return matchErrorKnowledge(stderr, entries, feedbackMap).slice(0, limit);
}

export function buildFeedbackMap(records: ErrorFeedbackRecord[]): Map<string, number> {
  const cutoff = Date.now() - FEEDBACK_DECAY_DAYS * 24 * 60 * 60 * 1000;
  const recent = records.filter((r) => r.timestamp >= cutoff).slice(-FEEDBACK_WINDOW_ENTRIES * 5);
  const byEntry = new Map<string, ErrorFeedbackRecord[]>();
  for (const record of recent) {
    const list = byEntry.get(record.entryId) ?? [];
    list.push(record);
    byEntry.set(record.entryId, list);
  }
  const result = new Map<string, number>();
  for (const [entryId, entryRecords] of byEntry) {
    const window = entryRecords.slice(-FEEDBACK_WINDOW_ENTRIES);
    let bonus = 0;
    for (const record of window) {
      bonus += record.helpful ? FEEDBACK_WEIGHT_HELPFUL : FEEDBACK_WEIGHT_UNHELPFUL;
    }
    const decayFactor = calculateDecayFactor(entryRecords[entryRecords.length - 1]?.timestamp ?? 0, cutoff);
    result.set(entryId, roundScore(bonus * decayFactor));
  }
  return result;
}

export function createDefaultKnowledgeStore(): ErrorKnowledgeStore {
  return {
    version: 1,
    entries: [...BUILT_IN_ERROR_ENTRIES],
    feedback: [],
    lastUpdatedAt: Date.now(),
  };
}

export function addFeedback(store: ErrorKnowledgeStore, entryId: string, helpful: boolean): ErrorKnowledgeStore {
  const record: ErrorFeedbackRecord = { entryId, helpful, timestamp: Date.now() };
  return {
    ...store,
    feedback: [...store.feedback, record],
  };
}

export function mergeKnowledgeUpdate(
  local: ErrorKnowledgeStore,
  remoteEntries: ErrorKnowledgeEntry[],
  source: string,
): ErrorKnowledgeStore {
  if (!remoteEntries.length) {
    return local;
  }
  const existingIds = new Set(local.entries.map((e) => e.id));
  const merged = [...local.entries];
  for (const entry of remoteEntries) {
    if (!entry.id || !entry.patterns?.length) {
      continue;
    }
    if (existingIds.has(entry.id)) {
      const index = merged.findIndex((e) => e.id === entry.id);
      if (index >= 0) {
        merged[index] = normalizeEntry(entry);
      }
    } else {
      merged.push(normalizeEntry(entry));
    }
  }
  return {
    ...local,
    entries: merged,
    lastUpdatedAt: Date.now(),
    updateSource: source,
  };
}

export function normalizeEntry(entry: Partial<ErrorKnowledgeEntry>): ErrorKnowledgeEntry {
  return {
    id: String(entry.id ?? '').trim() || `entry-${Date.now()}`,
    category: normalizeCategory(entry.category),
    patterns: Array.isArray(entry.patterns) ? entry.patterns.filter((p) => typeof p === 'string' && p.trim()) : [],
    label: String(entry.label ?? '').trim() || '未知错误',
    causes: Array.isArray(entry.causes) ? entry.causes.filter((c) => typeof c === 'string' && c.trim()) : [],
    solutions: Array.isArray(entry.solutions) ? entry.solutions.filter((s) => typeof s === 'string' && s.trim()) : [],
    links: Array.isArray(entry.links) ? entry.links.filter((l) => typeof l === 'string' && l.trim()) : [],
    baseWeight:
      typeof entry.baseWeight === 'number' && Number.isFinite(entry.baseWeight)
        ? Math.min(2, Math.max(0, entry.baseWeight))
        : 0.5,
  };
}

export function filterEntriesByMinCount(entries: ErrorKnowledgeEntry[], minCount: number): boolean {
  return entries.length >= minCount;
}

function calculateFeedbackBonus(entryId: string, feedbackMap: Map<string, number>): number {
  return feedbackMap.get(entryId) ?? 0;
}

function calculateDecayFactor(latestTimestamp: number, cutoff: number): number {
  if (latestTimestamp <= cutoff) {
    return 0.5;
  }
  const totalWindow = Date.now() - cutoff;
  if (totalWindow <= 0) {
    return 1;
  }
  const age = Date.now() - latestTimestamp;
  return Math.max(0.3, 1 - (age / totalWindow) * 0.5);
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const VALID_CATEGORIES: ErrorCategory[] = [
  'codec',
  'path',
  'disk',
  'font',
  'permission',
  'network',
  'memory',
  'ffmpeg-version',
  'input-format',
  'output-format',
  'hardware',
  'timeout',
  'subtitles',
  'audio',
  'general',
];

function normalizeCategory(value: unknown): ErrorCategory {
  return VALID_CATEGORIES.includes(value as ErrorCategory) ? (value as ErrorCategory) : 'general';
}
