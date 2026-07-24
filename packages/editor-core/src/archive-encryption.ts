export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface EncryptedArchiveOptions {
  password: string;
  hideMetadata?: boolean;
  volumeSizeMB?: number;
}

export interface ArchiveFileInfo {
  fileCount: number;
  totalSizeBytes: number;
  projectName?: string;
  projectDescription?: string;
}

export interface VolumeSplitResult {
  volumeIndex: number;
  sizeBytes: number;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) return 'weak';
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

export function stripArchiveMetadata(info: ArchiveFileInfo): { fileCount: number; totalSizeBytes: number } {
  return { fileCount: info.fileCount, totalSizeBytes: info.totalSizeBytes };
}

export function calculateVolumeSplits(totalSizeBytes: number, volumeSizeMB: number): VolumeSplitResult[] {
  if (volumeSizeMB <= 0) return [{ volumeIndex: 1, sizeBytes: totalSizeBytes }];
  const volumeSizeBytes = volumeSizeMB * 1024 * 1024;
  const volumes: VolumeSplitResult[] = [];
  let remaining = totalSizeBytes;
  let index = 1;
  while (remaining > 0) {
    const chunk = Math.min(remaining, volumeSizeBytes);
    volumes.push({ volumeIndex: index, sizeBytes: chunk });
    remaining -= chunk;
    index++;
  }
  return volumes;
}

export function validateEncryptionOptions(options: EncryptedArchiveOptions): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!options.password || options.password.length < 1) {
    errors.push('密码不能为空');
  } else {
    if (options.password.length < 8) {
      errors.push('密码长度不能少于 8 个字符');
    }
    if (!/[A-Z]/.test(options.password) || !/[a-z]/.test(options.password) || !/[0-9]/.test(options.password)) {
      errors.push('密码必须包含大写字母、小写字母和数字');
    }
  }
  if (options.volumeSizeMB !== undefined && options.volumeSizeMB <= 0) {
    errors.push('分卷大小必须大于 0');
  }
  return { valid: errors.length === 0, errors };
}

export function buildArchiveManifest(info: ArchiveFileInfo, hideMetadata: boolean): Record<string, unknown> {
  if (hideMetadata) {
    return { fileCount: info.fileCount, totalSizeBytes: info.totalSizeBytes };
  }
  return {
    fileCount: info.fileCount,
    totalSizeBytes: info.totalSizeBytes,
    projectName: info.projectName,
    projectDescription: info.projectDescription,
  };
}

export function formatVolumeName(baseName: string, volumeIndex: number, totalVolumes: number): string {
  if (totalVolumes <= 1) return baseName;
  const ext = baseName.includes('.') ? '.' + baseName.split('.').pop() : '';
  const nameNoExt = ext ? baseName.slice(0, -ext.length) : baseName;
  return `${nameNoExt}.part${String(volumeIndex).padStart(3, '0')}${ext}`;
}
