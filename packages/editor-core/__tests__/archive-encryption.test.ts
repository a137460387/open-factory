import { describe, expect, it } from 'vitest';
import {
  evaluatePasswordStrength,
  stripArchiveMetadata,
  calculateVolumeSplits,
  validateEncryptionOptions,
  buildArchiveManifest,
  formatVolumeName,
  ArchiveFileInfo,
} from '../src/archive-encryption';

describe('evaluatePasswordStrength', () => {
  it('空密码为 weak', () => {
    expect(evaluatePasswordStrength('')).toBe('weak');
  });

  it('短纯数字密码为 weak', () => {
    expect(evaluatePasswordStrength('123')).toBe('weak');
  });

  it('8位以上有数字+大小写为 medium', () => {
    expect(evaluatePasswordStrength('Abcdef12')).toBe('medium');
  });

  it('12位以上含大小写+数字+特殊字符为 strong', () => {
    expect(evaluatePasswordStrength('Abcdefgh12!@')).toBe('strong');
  });

  it('仅小写6位为 weak（得分1：仅小写）', () => {
    expect(evaluatePasswordStrength('abcdef')).toBe('weak');
  });

  it('小写+数字+大写12位为 strong（得分5: len≥8 + len≥12 + 大写 + 小写 + 数字）', () => {
    expect(evaluatePasswordStrength('Abcdefghij01')).toBe('strong');
  });

  it('强密码边界：12位+大写+小写+数字+特殊=5分=strong', () => {
    expect(evaluatePasswordStrength('Aa1bcdefghij')).toBe('strong');
  });
});

describe('stripArchiveMetadata', () => {
  it('只保留 fileCount 和 totalSizeBytes', () => {
    const info: ArchiveFileInfo = {
      fileCount: 10,
      totalSizeBytes: 1024,
      projectName: 'My Project',
      projectDescription: 'Secret description',
    };
    const stripped = stripArchiveMetadata(info);
    expect(stripped.fileCount).toBe(10);
    expect(stripped.totalSizeBytes).toBe(1024);
    expect((stripped as Record<string, unknown>).projectName).toBeUndefined();
    expect((stripped as Record<string, unknown>).projectDescription).toBeUndefined();
  });
});

describe('calculateVolumeSplits', () => {
  it('总大小不超过单卷时返回一个卷', () => {
    const volumes = calculateVolumeSplits(500 * 1024 * 1024, 2048);
    expect(volumes).toHaveLength(1);
    expect(volumes[0].volumeIndex).toBe(1);
    expect(volumes[0].sizeBytes).toBe(500 * 1024 * 1024);
  });

  it('总大小超过单卷时正确分卷', () => {
    // 5GB total, 2GB per volume → 3 volumes
    const fiveGB = 5 * 1024 * 1024 * 1024;
    const volumes = calculateVolumeSplits(fiveGB, 2048);
    expect(volumes).toHaveLength(3);
    expect(volumes[0].sizeBytes).toBe(2048 * 1024 * 1024);
    expect(volumes[1].sizeBytes).toBe(2048 * 1024 * 1024);
    expect(volumes[2].sizeBytes).toBe(fiveGB - 2 * 2048 * 1024 * 1024);
    // 卷号递增
    expect(volumes[0].volumeIndex).toBe(1);
    expect(volumes[2].volumeIndex).toBe(3);
  });

  it('volumeSizeMB <= 0 时返回单卷（不拆分）', () => {
    const volumes = calculateVolumeSplits(1024, 0);
    expect(volumes).toHaveLength(1);
    expect(volumes[0].sizeBytes).toBe(1024);
  });

  it('空文件返回空数组（remaining=0 不进入循环）', () => {
    const volumes = calculateVolumeSplits(0, 2048);
    expect(volumes).toHaveLength(0);
  });

  it('整除时最后一卷恰好等于卷大小', () => {
    const volSize = 1024 * 1024; // 1MB
    const totalSize = volSize * 3;
    const volumes = calculateVolumeSplits(totalSize, 1);
    expect(volumes).toHaveLength(3);
    for (const v of volumes) {
      expect(v.sizeBytes).toBe(volSize);
    }
  });
});

describe('validateEncryptionOptions', () => {
  it('合法选项通过校验', () => {
    const result = validateEncryptionOptions({ password: 'Abc12345!' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('空密码报错', () => {
    const result = validateEncryptionOptions({ password: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.join('')).toContain('密码不能为空');
  });

  it('volumeSizeMB <= 0 报错', () => {
    const result = validateEncryptionOptions({ password: 'abc', volumeSizeMB: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors.join('')).toContain('分卷大小必须大于 0');
  });

  it('volumeSizeMB = 0 报错', () => {
    const result = validateEncryptionOptions({ password: 'abc', volumeSizeMB: 0 });
    expect(result.valid).toBe(false);
  });
});

describe('buildArchiveManifest', () => {
  const info: ArchiveFileInfo = {
    fileCount: 5,
    totalSizeBytes: 2048,
    projectName: 'Test Project',
    projectDescription: 'A test project',
  };

  it('hideMetadata=true 时隐藏项目信息', () => {
    const manifest = buildArchiveManifest(info, true);
    expect(manifest.fileCount).toBe(5);
    expect(manifest.totalSizeBytes).toBe(2048);
    expect(manifest.projectName).toBeUndefined();
    expect(manifest.projectDescription).toBeUndefined();
  });

  it('hideMetadata=false 时包含完整信息', () => {
    const manifest = buildArchiveManifest(info, false);
    expect(manifest.projectName).toBe('Test Project');
    expect(manifest.projectDescription).toBe('A test project');
    expect(manifest.fileCount).toBe(5);
  });
});

describe('formatVolumeName', () => {
  it('单卷时返回原始文件名', () => {
    expect(formatVolumeName('archive.zip', 1, 1)).toBe('archive.zip');
  });

  it('多卷时返回 .part001 格式', () => {
    expect(formatVolumeName('archive.zip', 1, 3)).toBe('archive.part001.zip');
    expect(formatVolumeName('archive.zip', 2, 3)).toBe('archive.part002.zip');
    expect(formatVolumeName('archive.zip', 3, 3)).toBe('archive.part003.zip');
  });

  it('无扩展名时正确处理', () => {
    expect(formatVolumeName('archive', 1, 2)).toBe('archive.part001');
    expect(formatVolumeName('archive', 2, 2)).toBe('archive.part002');
  });
});
