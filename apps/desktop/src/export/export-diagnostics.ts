export interface ExportDiagnosticMatch {
  pattern: string;
  label: string;
  suggestion: string;
}

export const EXPORT_ERROR_PATTERNS: ExportDiagnosticMatch[] = [
  {
    pattern: 'Unknown encoder|Unknown decoder|codec not supported|not compatible with',
    label: '编解码器不支持',
    suggestion: '请检查导出预设中的编解码器设置。尝试切换为 libx264/libx265 或其他兼容编解码器。',
  },
  {
    pattern: 'No such file or directory|invalid argument|path.*invalid|special character',
    label: '输出路径异常',
    suggestion: '输出路径包含特殊字符或目录不存在。请检查路径中是否含有中文、空格或特殊符号，并确认目录已存在。',
  },
  {
    pattern: 'No space left|disk full|not enough space|ENOSPC',
    label: '磁盘空间不足',
    suggestion: '磁盘剩余空间不足。请清理磁盘或将输出目录改到其他有足够空间的分区。',
  },
  {
    pattern: 'Permission denied|access denied|EACCES',
    label: '权限不足',
    suggestion: '没有写入目标文件的权限。请检查输出目录的文件权限，或以管理员身份运行。',
  },
  {
    pattern: 'Invalid data found|corrupt|truncated|broken',
    label: '源文件损坏',
    suggestion: '输入媒体文件可能已损坏或不完整。请尝试重新导入或用其他工具修复源文件。',
  },
];

/**
 * Match FFmpeg stderr output against known error patterns.
 * Returns all matched diagnostics.
 */
export function matchExportDiagnostics(stderr: string): ExportDiagnosticMatch[] {
  if (!stderr) return [];
  const matches: ExportDiagnosticMatch[] = [];
  for (const entry of EXPORT_ERROR_PATTERNS) {
    const regex = new RegExp(entry.pattern, 'i');
    if (regex.test(stderr)) {
      matches.push(entry);
    }
  }
  return matches;
}
