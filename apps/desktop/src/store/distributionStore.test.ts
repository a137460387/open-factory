// @vitest-environment jsdom
// 源文件：apps/desktop/src/store/distributionStore.ts（127 可执行行，五期前覆盖 0%）
// 覆盖目标：≥70%。模式：直接 store.getState() 断言状态变化（纯 zustand，无外部依赖）。

import { describe, it, expect, beforeEach } from 'vitest';
import { useDistributionStore } from './distributionStore';

beforeEach(() => {
  useDistributionStore.getState().reset();
});

describe('useDistributionStore setter 与函数式更新器', () => {
  it('平台选择：toggle 增删 / selectAll / clear', () => {
    const store = useDistributionStore.getState();
    store.togglePlatform('youtube-1080p');
    store.togglePlatform('tiktok');
    expect(useDistributionStore.getState().selectedPlatforms).toEqual(['youtube-1080p', 'tiktok']);

    useDistributionStore.getState().togglePlatform('youtube-1080p');
    expect(useDistributionStore.getState().selectedPlatforms).toEqual(['tiktok']);

    useDistributionStore.getState().selectAllPlatforms(['youtube-1080p', 'tiktok', 'bilibili']);
    expect(useDistributionStore.getState().selectedPlatforms).toHaveLength(3);

    useDistributionStore.getState().clearPlatforms();
    const cleared = useDistributionStore.getState();
    expect(cleared.selectedPlatforms).toEqual([]);
    expect(cleared.cropResults.size).toBe(0);
  });

  it('基础 setter 支持值与函数式更新（isAnalyzing/outputDir/template）', () => {
    useDistributionStore.getState().setIsAnalyzing(true);
    expect(useDistributionStore.getState().isAnalyzing).toBe(true);
    useDistributionStore.getState().setIsAnalyzing((v) => !v);
    expect(useDistributionStore.getState().isAnalyzing).toBe(false);

    useDistributionStore.getState().setOutputDir('D:/exports');
    expect(useDistributionStore.getState().outputDir).toBe('D:/exports');

    useDistributionStore.getState().setTemplate((t) => `${t}-v2`);
    expect(useDistributionStore.getState().template).toBe('{project}-{platform}-{resolution}-v2');
  });

  it('结果对象 setter（currentBatch/multiFormatResult/coverResult/null 清空）', () => {
    const batch = { batchId: 'b1' } as never;
    useDistributionStore.getState().setCurrentBatch(batch);
    expect(useDistributionStore.getState().currentBatch).toEqual(batch);
    useDistributionStore.getState().setCurrentBatch(null);
    expect(useDistributionStore.getState().currentBatch).toBeNull();

    useDistributionStore.getState().setMultiFormatResult({ formats: [] } as never);
    expect(useDistributionStore.getState().multiFormatResult).toMatchObject({ formats: [] });

    useDistributionStore.getState().setCoverResult({ covers: [] } as never);
    expect(useDistributionStore.getState().coverResult).toMatchObject({ covers: [] });
  });

  it('Map setter（cropResults/formatPreviews/platformAdaptations）替换引用', () => {
    const crops = new Map([['youtube', { width: 1080 }]]);
    useDistributionStore.getState().setCropResults(crops as never);
    expect(useDistributionStore.getState().cropResults).toBe(crops);

    const previews = new Map([['youtube', { url: 'x' }]]);
    useDistributionStore.getState().setFormatPreviews(previews as never);
    expect(useDistributionStore.getState().formatPreviews).toBe(previews);

    const adaptations = new Map([['tiktok', { suggestion: 'y' }]]);
    useDistributionStore.getState().setPlatformAdaptations(adaptations as never);
    expect(useDistributionStore.getState().platformAdaptations).toBe(adaptations);

    useDistributionStore.getState().setAdaptationSuggestions([{ id: 's1' } as never]);
    expect(useDistributionStore.getState().adaptationSuggestions).toHaveLength(1);
  });

  it('生成中标记 setter（isGeneratingFormats/isGeneratingCovers）', () => {
    useDistributionStore.getState().setIsGeneratingFormats(true);
    useDistributionStore.getState().setIsGeneratingCovers(true);
    const state = useDistributionStore.getState();
    expect(state.isGeneratingFormats).toBe(true);
    expect(state.isGeneratingCovers).toBe(true);
  });
});

describe('useDistributionStore 任务操作', () => {
  function seedTasks() {
    useDistributionStore.getState().setTasks([
      { id: 't1', status: 'pending', progress: 0 } as never,
      { id: 't2', status: 'running', progress: 0.4 } as never,
    ]);
  }

  it('updateTaskProgress 钳制到 [0,1] 并只更新目标任务', () => {
    seedTasks();
    useDistributionStore.getState().updateTaskProgress('t2', 1.5);
    useDistributionStore.getState().updateTaskProgress('t1', -0.2);
    const tasks = useDistributionStore.getState().tasks;
    expect(tasks[0].progress).toBe(0);
    expect(tasks[1].progress).toBe(1);
  });

  it('finishTask 置 success 且进度归一', () => {
    seedTasks();
    useDistributionStore.getState().finishTask('t2');
    const task = useDistributionStore.getState().tasks.find((t) => t.id === 't2');
    expect(task).toMatchObject({ status: 'success', progress: 1 });
  });

  it('failTask 写入 error；cancelTask 置 canceled', () => {
    seedTasks();
    useDistributionStore.getState().failTask('t1', 'network down');
    useDistributionStore.getState().cancelTask('t2');
    const tasks = useDistributionStore.getState().tasks;
    expect(tasks[0]).toMatchObject({ status: 'error', error: 'network down' });
    expect(tasks[1]).toMatchObject({ status: 'canceled' });
  });
});

describe('useDistributionStore 计划与历史', () => {
  it('addSchedule 追加；updateScheduleStatus 更新状态/错误/时间戳', () => {
    useDistributionStore.getState().addSchedule({ id: 'sch1', status: 'pending' } as never);
    useDistributionStore.getState().addSchedule({ id: 'sch2', status: 'pending' } as never);
    expect(useDistributionStore.getState().schedules).toHaveLength(2);

    useDistributionStore.getState().updateScheduleStatus('sch1', 'failed', 'auth failed');
    const schedule = useDistributionStore.getState().schedules.find((s) => s.id === 'sch1');
    expect(schedule).toMatchObject({ status: 'failed', error: 'auth failed' });
    expect(typeof schedule!.updatedAt).toBe('string');
  });

  it('addHistoryEntry 头部插入并裁剪到 200 条', () => {
    for (let i = 0; i < 205; i += 1) {
      useDistributionStore.getState().addHistoryEntry({ id: `e${i}` } as never);
    }
    const history = useDistributionStore.getState().history;
    expect(history).toHaveLength(200);
    expect(history[0].id).toBe('e204');
  });

  it('reset 恢复全部初始值', () => {
    useDistributionStore.getState().setOutputDir('D:/x');
    useDistributionStore.getState().setTasks([{ id: 't1' } as never]);
    useDistributionStore.getState().addHistoryEntry({ id: 'e1' } as never);
    useDistributionStore.getState().reset();
    const state = useDistributionStore.getState();
    expect(state.outputDir).toBe('');
    expect(state.tasks).toEqual([]);
    expect(state.history).toEqual([]);
    expect(state.template).toBe('{project}-{platform}-{resolution}');
  });
});
