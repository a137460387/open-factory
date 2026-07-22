import { describe, it, expect } from 'vitest';
import {
  createBatchRender,
  startBatchRender,
  completeBatchRender,
  cancelBatchRender,
  calculateBatchProgress,
  addCompletionAction,
  removeCompletionAction,
  toggleCompletionAction,
  updateCompletionAction,
  getEnabledActions,
  buildCompletionNotificationMessage,
} from '../src/export/batch-render-actions';

describe('batch-render-actions', () => {
  describe('createBatchRender', () => {
    it('creates a batch with task ids', () => {
      const batch = createBatchRender({ taskIds: ['t1', 't2', 't3'] });
      expect(batch.taskIds).toEqual(['t1', 't2', 't3']);
      expect(batch.status).toBe('pending');
      expect(batch.id).toBeTruthy();
    });

    it('creates with custom name', () => {
      const batch = createBatchRender({ name: '夜间渲染', taskIds: ['t1'] });
      expect(batch.name).toBe('夜间渲染');
    });

    it('has default completion action', () => {
      const batch = createBatchRender({ taskIds: ['t1'] });
      expect(batch.completionActions.length).toBeGreaterThanOrEqual(1);
      expect(batch.completionActions[0].type).toBe('notify');
    });
  });

  describe('batch lifecycle', () => {
    it('transitions through states', () => {
      let batch = createBatchRender({ taskIds: ['t1'] });
      expect(batch.status).toBe('pending');

      batch = startBatchRender(batch);
      expect(batch.status).toBe('running');
      expect(batch.startedAt).toBeTruthy();

      batch = completeBatchRender(batch);
      expect(batch.status).toBe('completed');
      expect(batch.finishedAt).toBeTruthy();
    });

    it('can cancel from any active state', () => {
      let batch = createBatchRender({ taskIds: ['t1'] });
      batch = startBatchRender(batch);
      batch = cancelBatchRender(batch);
      expect(batch.status).toBe('canceled');
    });
  });

  describe('calculateBatchProgress', () => {
    it('calculates progress correctly', () => {
      const batch = createBatchRender({ taskIds: ['t1', 't2', 't3'] });
      const statuses = new Map([
        ['t1', { status: 'success', progress: 1, name: 'Task 1' }],
        ['t2', { status: 'running', progress: 0.5, name: 'Task 2' }],
        ['t3', { status: 'pending', progress: 0, name: 'Task 3' }],
      ]);

      const progress = calculateBatchProgress(batch, statuses);
      expect(progress.totalTasks).toBe(3);
      expect(progress.completedTasks).toBe(1);
      expect(progress.currentTaskId).toBe('t2');
      expect(progress.overallProgress).toBeCloseTo(0.5, 1);
    });

    it('handles empty batch', () => {
      const batch = createBatchRender({ taskIds: [] });
      const progress = calculateBatchProgress(batch, new Map());
      expect(progress.totalTasks).toBe(0);
      expect(progress.overallProgress).toBe(0);
    });

    it('counts failed tasks', () => {
      const batch = createBatchRender({ taskIds: ['t1', 't2'] });
      const statuses = new Map([
        ['t1', { status: 'success', progress: 1 }],
        ['t2', { status: 'error', progress: 0.3 }],
      ]);
      const progress = calculateBatchProgress(batch, statuses);
      expect(progress.failedTasks).toBe(1);
    });
  });

  describe('completion actions', () => {
    it('adds new action', () => {
      const actions = addCompletionAction([], 'shutdown');
      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe('shutdown');
      expect(actions[0].enabled).toBe(true);
    });

    it('removes action', () => {
      const actions = addCompletionAction([], 'shutdown');
      const result = removeCompletionAction(actions, actions[0].id);
      expect(result.length).toBe(0);
    });

    it('toggles action', () => {
      const actions = addCompletionAction([], 'notify');
      const toggled = toggleCompletionAction(actions, actions[0].id);
      expect(toggled[0].enabled).toBe(false);
      const toggledBack = toggleCompletionAction(toggled, toggled[0].id);
      expect(toggledBack[0].enabled).toBe(true);
    });

    it('updates action', () => {
      const actions = addCompletionAction([], 'notify');
      const updated = updateCompletionAction(actions, actions[0].id, { messageTemplate: '完成！' });
      expect(updated[0].messageTemplate).toBe('完成！');
    });

    it('filters enabled actions', () => {
      let actions = addCompletionAction([], 'notify');
      actions = addCompletionAction(actions, 'shutdown');
      actions = toggleCompletionAction(actions, actions[1].id);
      const enabled = getEnabledActions(actions);
      expect(enabled.length).toBe(1);
      expect(enabled[0].type).toBe('notify');
    });
  });

  describe('buildCompletionNotificationMessage', () => {
    it('substitutes template variables', () => {
      const template = '「{batchName}」渲染完成：{completed}/{total} 成功，耗时 {duration}';
      const msg = buildCompletionNotificationMessage(template, {
        batchName: '夜间渲染',
        totalTasks: 10,
        completedTasks: 9,
        failedTasks: 1,
        durationSeconds: 3723,
      });
      expect(msg).toContain('夜间渲染');
      expect(msg).toContain('9');
      expect(msg).toContain('10');
      expect(msg).toContain('1h');
    });
  });
});
