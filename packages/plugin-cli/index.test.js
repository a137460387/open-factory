import { describe, it, expect } from 'vitest';

describe('plugin-cli', () => {
  it('应能导入 create 模块', async () => {
    const mod = await import('./src/create.js');
    expect(typeof mod.createPlugin).toBe('function');
  });

  it('应能导入 validate 模块', async () => {
    const mod = await import('./src/validate.js');
    expect(typeof mod.validatePlugin).toBe('function');
  });

  it('应能导入 hash 模块', async () => {
    const mod = await import('./src/hash.js');
    expect(typeof mod.hashPlugin).toBe('function');
  });

  it('应能导入 debug 模块', async () => {
    const mod = await import('./src/debug.js');
    expect(typeof mod.debugPlugin).toBe('function');
  });

  it('应能导入 test-runner 模块', async () => {
    const mod = await import('./src/test-runner.js');
    expect(typeof mod.testPlugin).toBe('function');
  });
});
