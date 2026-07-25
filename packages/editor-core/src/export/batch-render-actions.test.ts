import { describe, it, expect } from 'vitest';
import {
  COMPLETION_ACTION_LABELS,
  DEFAULT_COMPLETION_ACTIONS,
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
  DEFAULT_NOTIFY_TEMPLATE,
} from './batch-render-actions';

describe('COMPLETION_ACTION_LABELS', () => {
  it('has notify label', () => {
    expect(COMPLETION_ACTION_LABELS.notify).toBeDefined();
    expect(typeof COMPLETION_ACTION_LABELS.notify).toBe('string');
  });

  it('has shutdown label', () => {
    expect(COMPLETION_ACTION_LABELS.shutdown).toBeDefined();
  });
});

describe('DEFAULT_COMPLETION_ACTIONS', () => {
  it('is not empty', () => {
    expect(DEFAULT_COMPLETION_ACTIONS.length).toBeGreaterThan(0);
  });
});

describe('createBatchRender', () => {
  it('creates batch with required fields', () => {
    const batch = createBatchRender({ taskIds: ['t1', 't2'] });
    expect(batch.taskIds).toEqual(['t1', 't2']);
    expect(batch.status).toBe('pending');
    expect(batch.id).toBeDefined();
  });

  it('uses provided name', () => {
    const batch = createBatchRender({ name: 'My Batch', taskIds: ['t1'] });
    expect(batch.name).toBe('My Batch');
  });

  it('uses custom completion actions', () => {
    const actions = [{ id: 'a1', type: 'notify' as const, enabled: true }];
    const batch = createBatchRender({ taskIds: ['t1'], completionActions: actions });
    expect(batch.completionActions).toEqual(actions);
  });
});

describe('startBatchRender', () => {
  it('sets status to running', () => {
    const batch = createBatchRender({ taskIds: ['t1'] });
    const result = startBatchRender(batch, '2024-01-01T00:00:00Z');
    expect(result.status).toBe('running');
    expect(result.startedAt).toBe('2024-01-01T00:00:00Z');
  });
});

describe('completeBatchRender', () => {
  it('sets status to completed', () => {
    const batch = createBatchRender({ taskIds: ['t1'] });
    const result = completeBatchRender(batch, '2024-01-01T01:00:00Z');
    expect(result.status).toBe('completed');
    expect(result.finishedAt).toBe('2024-01-01T01:00:00Z');
  });
});

describe('cancelBatchRender', () => {
  it('sets status to canceled', () => {
    const batch = createBatchRender({ taskIds: ['t1'] });
    const result = cancelBatchRender(batch, '2024-01-01T01:00:00Z');
    expect(result.status).toBe('canceled');
    expect(result.finishedAt).toBe('2024-01-01T01:00:00Z');
  });
});

describe('calculateBatchProgress', () => {
  it('calculates progress', () => {
    const batch = createBatchRender({ taskIds: ['t1', 't2', 't3'] });
    const statuses = new Map([
      ['t1', { status: 'success', progress: 1 }],
      ['t2', { status: 'running', progress: 0.5, name: 'task2' }],
      ['t3', { status: 'pending', progress: 0 }],
    ]);
    const result = calculateBatchProgress(batch, statuses);
    expect(result.completedTasks).toBe(1);
    expect(result.totalTasks).toBe(3);
  });

  it('handles error tasks', () => {
    const batch = createBatchRender({ taskIds: ['t1'] });
    const statuses = new Map([['t1', { status: 'error', progress: 0 }]]);
    const result = calculateBatchProgress(batch, statuses);
    expect(result.failedTasks).toBe(1);
  });

  it('handles missing task status', () => {
    const batch = createBatchRender({ taskIds: ['t1', 't2'] });
    const statuses = new Map([['t1', { status: 'success', progress: 1 }]]);
    const result = calculateBatchProgress(batch, statuses);
    expect(result.totalTasks).toBe(2);
  });
});

describe('addCompletionAction', () => {
  it('adds action', () => {
    const result = addCompletionAction([], 'notify');
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('notify');
    expect(result[0].enabled).toBe(true);
    expect(result[0].id).toBeDefined();
  });
});

describe('removeCompletionAction', () => {
  it('removes action by id', () => {
    const actions = addCompletionAction([], 'notify');
    const result = removeCompletionAction(actions, actions[0].id);
    expect(result.length).toBe(0);
  });

  it('keeps non-matching actions', () => {
    const actions = addCompletionAction([], 'notify');
    const result = removeCompletionAction(actions, 'nonexistent');
    expect(result.length).toBe(1);
  });
});

describe('toggleCompletionAction', () => {
  it('toggles enabled state', () => {
    const actions = addCompletionAction([], 'notify');
    expect(actions[0].enabled).toBe(true);
    const result = toggleCompletionAction(actions, actions[0].id);
    expect(result[0].enabled).toBe(false);
  });
});

describe('updateCompletionAction', () => {
  it('updates action', () => {
    const actions = addCompletionAction([], 'notify');
    const result = updateCompletionAction(actions, actions[0].id, { enabled: false, delaySeconds: 5 });
    expect(result[0].enabled).toBe(false);
    expect(result[0].delaySeconds).toBe(5);
  });
});

describe('getEnabledActions', () => {
  it('filters enabled actions', () => {
    const actions = [
      { id: 'a1', type: 'notify' as const, enabled: true },
      { id: 'a2', type: 'shutdown' as const, enabled: false },
    ];
    const result = getEnabledActions(actions);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('a1');
  });
});

describe('buildCompletionNotificationMessage', () => {
  it('builds message from template', () => {
    const msg = buildCompletionNotificationMessage(
      '{batchName}: {completed}/{total} done, {failed} failed',
      { batchName: 'Test', totalTasks: 3, completedTasks: 2, failedTasks: 1 },
    );
    expect(msg).toContain('Test');
    expect(msg).toContain('2');
    expect(msg).toContain('3');
    expect(msg).toContain('1');
  });

  it('includes duration when provided', () => {
    const msg = buildCompletionNotificationMessage(
      'Done in {duration}',
      { batchName: 'Test', totalTasks: 1, completedTasks: 1, failedTasks: 0, durationSeconds: 65 },
    );
    expect(msg).toContain('1');
  });
});

describe('DEFAULT_NOTIFY_TEMPLATE', () => {
  it('is a string', () => {
    expect(typeof DEFAULT_NOTIFY_TEMPLATE).toBe('string');
    expect(DEFAULT_NOTIFY_TEMPLATE.length).toBeGreaterThan(0);
  });
});
