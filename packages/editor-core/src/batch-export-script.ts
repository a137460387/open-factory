export interface BatchExportTask {
  projectPath: string;
  preset?: string;
  outputDir?: string;
  outputName?: string;
}

export interface BatchExportScript {
  version: 1;
  tasks: BatchExportTask[];
  defaultPreset?: string;
  defaultOutputDir?: string;
}

export interface BatchExportTaskResult {
  projectPath: string;
  status: 'success' | 'error';
  durationMs: number;
  error?: string;
  outputPath?: string;
}

export interface BatchExportLog {
  startedAt: string;
  completedAt: string;
  scriptPath: string;
  results: BatchExportTaskResult[];
}

export interface CliBatchArg {
  batchScriptPath: string;
}

const LOCAL_PATH_RE = /^[a-zA-Z]:\\|^\/|^\.\//;
const URL_RE = /^https?:\/\//i;
const SHELL_INJECTION_RE = /[;&|`$(){}!#]/;

export function validateBatchExportScript(raw: unknown): {
  valid: boolean;
  errors: string[];
  script?: BatchExportScript;
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['脚本必须是 JSON 对象'] };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    errors.push('version 必须为 1');
  }
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    errors.push('tasks 必须是非空数组');
    return { valid: false, errors };
  }
  for (let i = 0; i < obj.tasks.length; i++) {
    const task = obj.tasks[i] as Record<string, unknown>;
    if (typeof task.projectPath !== 'string' || !task.projectPath.trim()) {
      errors.push(`tasks[${i}].projectPath 不能为空`);
    } else if (!isLocalPath(task.projectPath)) {
      errors.push(`tasks[${i}].projectPath 必须是本地路径`);
    } else if (SHELL_INJECTION_RE.test(task.projectPath)) {
      errors.push(`tasks[${i}].projectPath 包含不安全字符`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    errors: [],
    script: {
      version: 1,
      tasks: (obj.tasks as Array<Record<string, unknown>>).map((t) => ({
        projectPath: String(t.projectPath).trim(),
        preset: typeof t.preset === 'string' ? t.preset : undefined,
        outputDir: typeof t.outputDir === 'string' ? t.outputDir : undefined,
        outputName: typeof t.outputName === 'string' ? t.outputName : undefined,
      })),
      defaultPreset: typeof obj.defaultPreset === 'string' ? obj.defaultPreset : undefined,
      defaultOutputDir: typeof obj.defaultOutputDir === 'string' ? obj.defaultOutputDir : undefined,
    },
  };
}

export function parseBatchScriptJson(jsonStr: string): {
  valid: boolean;
  errors: string[];
  script?: BatchExportScript;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { valid: false, errors: ['无效的 JSON 格式'] };
  }
  return validateBatchExportScript(parsed);
}

export function parseCliBatchArgs(argv: string[]): CliBatchArg | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--batch' && i + 1 < argv.length) {
      return { batchScriptPath: argv[i + 1] };
    }
  }
  return undefined;
}

export function formatBatchExportLog(log: BatchExportLog): string {
  const lines: string[] = [
    `批处理导出日志`,
    `脚本: ${log.scriptPath}`,
    `开始: ${log.startedAt}`,
    `完成: ${log.completedAt}`,
    `任务数: ${log.results.length}`,
    `---`,
  ];
  for (const r of log.results) {
    lines.push(`[${r.status}] ${r.projectPath} — ${r.durationMs}ms${r.error ? ` — ${r.error}` : ''}`);
  }
  return lines.join('\n');
}

export function createBatchExportTaskResult(
  projectPath: string,
  status: 'success' | 'error',
  durationMs: number,
  error?: string,
  outputPath?: string,
): BatchExportTaskResult {
  return { projectPath, status, durationMs, error, outputPath };
}

export function serializeGuiConfigToBatchScript(
  configs: Array<{ projectPath: string; preset?: string; outputDir?: string }>,
  defaultPreset?: string,
  defaultOutputDir?: string,
): BatchExportScript {
  return {
    version: 1,
    tasks: configs.map((c) => ({
      projectPath: c.projectPath,
      preset: c.preset,
      outputDir: c.outputDir,
    })),
    defaultPreset,
    defaultOutputDir,
  };
}

function isLocalPath(path: string): boolean {
  return LOCAL_PATH_RE.test(path) && !URL_RE.test(path);
}
