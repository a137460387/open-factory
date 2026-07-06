import { describe, expect, it } from 'vitest';
import {
  resolveNamingTemplate,
  resolveNamingTemplateBatch,
  previewNamingTemplate,
  formatDateForNaming,
  formatTimeForNaming,
  formatIndexForNaming,
  serializeNamingTemplateConfig,
  deserializeNamingTemplateConfig,
  DEFAULT_NAMING_TEMPLATE
} from '../src/naming-template';
import type { NamingTemplateConfig } from '../src/naming-template';

describe('naming template variable expansion', () => {
  it('expands {project} variable', () => {
    const result = resolveNamingTemplate(
      { template: '{project}' },
      { projectName: '我的项目', presetName: 'Web' }
    );
    expect(result).toBe('我的项目');
  });

  it('expands {preset} variable', () => {
    const result = resolveNamingTemplate(
      { template: '{preset}' },
      { projectName: 'P', presetName: 'Web1080p' }
    );
    expect(result).toBe('Web1080p');
  });

  it('expands {date} with YYYYMMDD format', () => {
    const result = resolveNamingTemplate(
      { template: '{date}', dateFormat: 'YYYYMMDD' },
      { projectName: 'P', presetName: 'P', date: '2024-03-15T10:00:00Z' }
    );
    expect(result).toMatch(/^\d{8}$/);
  });

  it('expands {date} with YYYY-MM-DD format', () => {
    const result = resolveNamingTemplate(
      { template: '{date}', dateFormat: 'YYYY-MM-DD' },
      { projectName: 'P', presetName: 'P', date: '2024-03-15T10:00:00Z' }
    );
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('expands {time} variable', () => {
    const result = resolveNamingTemplate(
      { template: '{time}' },
      { projectName: 'P', presetName: 'P', time: '2024-03-15T14:30:45Z' }
    );
    expect(result).toMatch(/^\d{6}$/);
  });

  it('expands {resolution} variable', () => {
    const result = resolveNamingTemplate(
      { template: '{resolution}' },
      { projectName: 'P', presetName: 'P', resolution: '1920x1080' }
    );
    expect(result).toBe('1920x1080');
  });

  it('expands {fps} variable', () => {
    const result = resolveNamingTemplate(
      { template: '{fps}' },
      { projectName: 'P', presetName: 'P', fps: 30 }
    );
    expect(result).toBe('30fps');
  });

  it('uses empty string for fps when not provided', () => {
    const result = resolveNamingTemplate(
      { template: '{fps}' },
      { projectName: 'P', presetName: 'P' }
    );
    expect(result).toBe('');
  });

  it('expands {text} custom text variable', () => {
    const result = resolveNamingTemplate(
      { template: '{text}', customText: '片段' },
      { projectName: 'P', presetName: 'P' }
    );
    expect(result).toBe('片段');
  });
});

describe('naming template index formatting', () => {
  it('formats index with padding', () => {
    expect(formatIndexForNaming(1, 3)).toBe('001');
    expect(formatIndexForNaming(42, 3)).toBe('042');
    expect(formatIndexForNaming(999, 3)).toBe('999');
    expect(formatIndexForNaming(1000, 3)).toBe('1000');
  });

  it('pads index to 3 digits by default', () => {
    const result = resolveNamingTemplate(
      { template: '{index}', indexPadding: 3 },
      { projectName: 'P', presetName: 'P', index: 5 }
    );
    expect(result).toBe('005');
  });

  it('supports custom padding', () => {
    const result = resolveNamingTemplate(
      { template: '{index}', indexPadding: 5 },
      { projectName: 'P', presetName: 'P', index: 7 }
    );
    expect(result).toBe('00007');
  });
});

describe('naming template batch resolution', () => {
  it('generates batch names with auto-incrementing index', () => {
    const config: NamingTemplateConfig = { template: '{project}_{index}', indexStart: 1, indexPadding: 3 };
    const results = resolveNamingTemplateBatch(config, { projectName: '项目', presetName: 'P' }, 3);
    expect(results).toEqual(['项目_001', '项目_002', '项目_003']);
  });

  it('batch names do not collide', () => {
    const config: NamingTemplateConfig = { template: '{project}_{preset}_{index}', indexStart: 10, indexPadding: 3 };
    const results = resolveNamingTemplateBatch(config, { projectName: 'MyProject', presetName: 'HD' }, 5);
    const unique = new Set(results);
    expect(unique.size).toBe(5);
  });
});

describe('naming template preview', () => {
  it('generates a preview string', () => {
    const preview = previewNamingTemplate(DEFAULT_NAMING_TEMPLATE);
    expect(preview).toContain('示例项目');
    expect(preview).toContain('Web1080p');
  });
});

describe('naming template serialization', () => {
  it('round-trips config through JSON', () => {
    const config: NamingTemplateConfig = {
      template: '{project}_{preset}_{date}_{index}',
      indexStart: 1,
      indexPadding: 3,
      dateFormat: 'YYYYMMDD'
    };
    const json = serializeNamingTemplateConfig(config);
    const restored = deserializeNamingTemplateConfig(json);
    expect(restored).toEqual(config);
  });

  it('handles invalid JSON gracefully', () => {
    expect(deserializeNamingTemplateConfig('not-json')).toBeUndefined();
  });

  it('handles missing template field', () => {
    expect(deserializeNamingTemplateConfig('{"foo":1}')).toBeUndefined();
  });
});
