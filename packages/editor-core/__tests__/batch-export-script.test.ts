import { describe, expect, it } from 'vitest';
import {
  validateBatchExportScript,
  parseBatchScriptJson,
  parseCliBatchArgs,
  formatBatchExportLog,
  createBatchExportTaskResult,
  serializeGuiConfigToBatchScript,
  BatchExportLog,
} from '../src/batch-export-script';

describe('validateBatchExportScript', () => {
  it('接受合法的脚本对象', () => {
    const result = validateBatchExportScript({
      version: 1,
      tasks: [{ projectPath: 'C:\\Users\\test\\project.ofp' }],
    });
    expect(result.valid).toBe(true);
    expect(result.script?.version).toBe(1);
    expect(result.script?.tasks).toHaveLength(1);
  });

  it('拒绝 version 不为 1', () => {
    const result = validateBatchExportScript({ version: 2, tasks: [{ projectPath: 'C:\\a.ofp' }] });
    expect(result.valid).toBe(false);
    expect(result.errors.join('')).toContain('version');
  });

  it('拒绝空 tasks 数组', () => {
    const result = validateBatchExportScript({ version: 1, tasks: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.join('')).toContain('tasks');
  });

  it('拒绝 projectPath 为空字符串', () => {
    const result = validateBatchExportScript({ version: 1, tasks: [{ projectPath: '  ' }] });
    expect(result.valid).toBe(false);
    expect(result.errors.join('')).toContain('projectPath');
  });

  it('拒绝 URL 路径', () => {
    const result = validateBatchExportScript({ version: 1, tasks: [{ projectPath: 'https://evil.com/payload' }] });
    expect(result.valid).toBe(false);
    expect(result.errors.join('')).toContain('本地路径');
  });

  it('拒绝包含 shell 注入字符的路径', () => {
    const result = validateBatchExportScript({ version: 1, tasks: [{ projectPath: 'C:\\test;rm -rf /' }] });
    expect(result.valid).toBe(false);
    expect(result.errors.join('')).toContain('不安全字符');
  });

  it('接受 Unix 绝对路径', () => {
    const result = validateBatchExportScript({ version: 1, tasks: [{ projectPath: '/home/user/project.ofp' }] });
    expect(result.valid).toBe(true);
  });

  it('接受相对路径 ./', () => {
    const result = validateBatchExportScript({ version: 1, tasks: [{ projectPath: './project.ofp' }] });
    expect(result.valid).toBe(true);
  });

  it('拒绝非对象输入', () => {
    expect(validateBatchExportScript(null).valid).toBe(false);
    expect(validateBatchExportScript(undefined).valid).toBe(false);
    expect(validateBatchExportScript('string').valid).toBe(false);
  });

  it('保留可选字段 preset/outputDir/outputName', () => {
    const result = validateBatchExportScript({
      version: 1,
      defaultPreset: '1080p',
      defaultOutputDir: 'C:\\output',
      tasks: [{ projectPath: 'C:\\a.ofp', preset: '720p', outputDir: 'D:\\out', outputName: 'video' }],
    });
    expect(result.valid).toBe(true);
    expect(result.script?.defaultPreset).toBe('1080p');
    expect(result.script?.defaultOutputDir).toBe('C:\\output');
    expect(result.script?.tasks[0].preset).toBe('720p');
    expect(result.script?.tasks[0].outputDir).toBe('D:\\out');
    expect(result.script?.tasks[0].outputName).toBe('video');
  });
});

describe('parseBatchScriptJson', () => {
  it('解析合法 JSON 字符串', () => {
    const json = JSON.stringify({ version: 1, tasks: [{ projectPath: 'C:\\a.ofp' }] });
    const result = parseBatchScriptJson(json);
    expect(result.valid).toBe(true);
    expect(result.script?.version).toBe(1);
  });

  it('拒绝无效 JSON', () => {
    const result = parseBatchScriptJson('{invalid');
    expect(result.valid).toBe(false);
    expect(result.errors.join('')).toContain('JSON');
  });

  it('JSON 合法但内容校验失败', () => {
    const json = JSON.stringify({ version: 99, tasks: [] });
    const result = parseBatchScriptJson(json);
    expect(result.valid).toBe(false);
  });
});

describe('parseCliBatchArgs', () => {
  it('解析 --batch 参数', () => {
    const result = parseCliBatchArgs(['--batch', 'script.json']);
    expect(result?.batchScriptPath).toBe('script.json');
  });

  it('无 --batch 参数返回 undefined', () => {
    const result = parseCliBatchArgs(['--other', 'value']);
    expect(result).toBeUndefined();
  });

  it('--batch 是最后一个参数（无值）返回 undefined', () => {
    const result = parseCliBatchArgs(['--batch']);
    expect(result).toBeUndefined();
  });

  it('空参数数组返回 undefined', () => {
    expect(parseCliBatchArgs([])).toBeUndefined();
  });

  it('忽略 --batch 后的额外参数', () => {
    const result = parseCliBatchArgs(['--batch', 'a.json', '--verbose']);
    expect(result?.batchScriptPath).toBe('a.json');
  });
});

describe('formatBatchExportLog', () => {
  it('格式化完整日志', () => {
    const log: BatchExportLog = {
      startedAt: '2026-06-23T10:00:00Z',
      completedAt: '2026-06-23T10:05:00Z',
      scriptPath: 'C:\\scripts\\batch.ofbatch.json',
      results: [
        createBatchExportTaskResult('C:\\proj1.ofp', 'success', 3000, undefined, 'C:\\out\\proj1.mp4'),
        createBatchExportTaskResult('C:\\proj2.ofp', 'error', 1500, '文件损坏'),
      ],
    };
    const output = formatBatchExportLog(log);
    expect(output).toContain('批处理导出日志');
    expect(output).toContain('脚本: C:\\scripts\\batch.ofbatch.json');
    expect(output).toContain('[success] C:\\proj1.ofp');
    expect(output).toContain('[error] C:\\proj2.ofp');
    expect(output).toContain('文件损坏');
    expect(output).toContain('3000ms');
  });

  it('无任务日志正确格式化', () => {
    const log: BatchExportLog = {
      startedAt: '2026-06-23T10:00:00Z',
      completedAt: '2026-06-23T10:00:00Z',
      scriptPath: 'a.json',
      results: [],
    };
    const output = formatBatchExportLog(log);
    expect(output).toContain('任务数: 0');
  });
});

describe('createBatchExportTaskResult', () => {
  it('创建成功结果', () => {
    const r = createBatchExportTaskResult('C:\\a.ofp', 'success', 2000, undefined, 'C:\\out.mp4');
    expect(r.status).toBe('success');
    expect(r.durationMs).toBe(2000);
    expect(r.outputPath).toBe('C:\\out.mp4');
    expect(r.error).toBeUndefined();
  });

  it('创建错误结果', () => {
    const r = createBatchExportTaskResult('C:\\b.ofp', 'error', 500, '导出失败');
    expect(r.status).toBe('error');
    expect(r.error).toBe('导出失败');
    expect(r.outputPath).toBeUndefined();
  });
});

describe('serializeGuiConfigToBatchScript', () => {
  it('序列化为合规脚本', () => {
    const script = serializeGuiConfigToBatchScript(
      [{ projectPath: 'C:\\a.ofp', preset: '1080p' }, { projectPath: 'C:\\b.ofp' }],
      '720p',
      'D:\\output',
    );
    expect(script.version).toBe(1);
    expect(script.tasks).toHaveLength(2);
    expect(script.defaultPreset).toBe('720p');
    expect(script.defaultOutputDir).toBe('D:\\output');
    // 序列化结果应当能通过校验
    const validation = validateBatchExportScript(script);
    expect(validation.valid).toBe(true);
  });

  it('不指定默认值时保持 undefined', () => {
    const script = serializeGuiConfigToBatchScript([{ projectPath: 'C:\\x.ofp' }]);
    expect(script.defaultPreset).toBeUndefined();
    expect(script.defaultOutputDir).toBeUndefined();
  });
});
