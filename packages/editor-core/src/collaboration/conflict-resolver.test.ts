import { describe, it, expect } from 'vitest';
import {
  createVectorClock,
  incrementClock,
  compareVectorClocks,
  detectConflict,
  resolveConflict,
  batchOperations,
  ConflictResolver,
  type VectorClock,
  type TimelineOperation,
  type ClockOrdering,
  type ConflictResolution,
} from './conflict-resolver';

// ─── Helpers ──────────────────────────────────────────────────────

function makeClock(entries: Record<string, number> = {}): VectorClock {
  return new Map(Object.entries(entries));
}

function makeOp(
  id: string,
  overrides: Partial<TimelineOperation> = {},
): TimelineOperation {
  return {
    type: 'update',
    target: 'clip',
    data: { id },
    timestamp: Date.now(),
    userId: 'user-1',
    vectorClock: makeClock({ 'user-1': 1 }),
    ...overrides,
  };
}

// ─── createVectorClock / incrementClock ───────────────────────────

describe('createVectorClock', () => {
  it('returns empty map', () => {
    const clock = createVectorClock();
    expect(clock.size).toBe(0);
  });

  it('returns a new instance each call', () => {
    const a = createVectorClock();
    const b = createVectorClock();
    expect(a).not.toBe(b);
  });

  it('is compatible with incrementClock', () => {
    const clock = incrementClock(createVectorClock(), 'user-1');
    expect(clock.get('user-1')).toBe(1);
  });
});

describe('incrementClock', () => {
  it('increments from 0 when key absent', () => {
    const result = incrementClock(makeClock(), 'u1');
    expect(result.get('u1')).toBe(1);
  });

  it('increments existing value', () => {
    const result = incrementClock(makeClock({ u1: 5 }), 'u1');
    expect(result.get('u1')).toBe(6);
  });

  it('returns a new map (immutable)', () => {
    const original = makeClock({ u1: 3 });
    const result = incrementClock(original, 'u1');
    expect(original.get('u1')).toBe(3);
    expect(result.get('u1')).toBe(4);
  });
});

// ─── compareVectorClocks ──────────────────────────────────────────

describe('compareVectorClocks', () => {
  it('returns after when a > b', () => {
    const a = makeClock({ u1: 3 });
    const b = makeClock({ u1: 1 });
    expect(compareVectorClocks(a, b)).toBe('after');
  });

  it('returns before when a < b', () => {
    const a = makeClock({ u1: 1 });
    const b = makeClock({ u1: 3 });
    expect(compareVectorClocks(a, b)).toBe('before');
  });

  it('returns concurrent when mixed ordering', () => {
    const a = makeClock({ u1: 3, u2: 1 });
    const b = makeClock({ u1: 1, u2: 3 });
    expect(compareVectorClocks(a, b)).toBe('concurrent');
  });

  it('returns after for equal clocks', () => {
    const a = makeClock({ u1: 2 });
    const b = makeClock({ u1: 2 });
    expect(compareVectorClocks(a, b)).toBe('after');
  });

  it('handles missing keys as 0', () => {
    const a = makeClock({ u1: 1 });
    const b = makeClock({});
    expect(compareVectorClocks(a, b)).toBe('after');
  });
});

// ─── detectConflict ───────────────────────────────────────────────

describe('detectConflict', () => {
  it('detects conflict for concurrent ops on same target', () => {
    const opA = makeOp('clip-1', {
      vectorClock: makeClock({ u1: 2, u2: 1 }),
      userId: 'u1',
    });
    const opB = makeOp('clip-1', {
      vectorClock: makeClock({ u1: 1, u2: 2 }),
      userId: 'u2',
    });
    expect(detectConflict(opA, opB)).toBe(true);
  });

  it('no conflict when ops are causally ordered', () => {
    const opA = makeOp('clip-1', { vectorClock: makeClock({ u1: 1 }) });
    const opB = makeOp('clip-1', { vectorClock: makeClock({ u1: 3 }) });
    expect(detectConflict(opA, opB)).toBe(false);
  });

  it('no conflict when ops target different entities', () => {
    const opA = makeOp('clip-1', {
      vectorClock: makeClock({ u1: 1, u2: 1 }),
    });
    const opB = makeOp('clip-2', {
      vectorClock: makeClock({ u1: 1, u2: 1 }),
    });
    expect(detectConflict(opA, opB)).toBe(false);
  });

  it('detects duplicate add on same id as conflict', () => {
    const opA = makeOp('clip-1', {
      type: 'add',
      vectorClock: makeClock({ u1: 2, u2: 1 }),
    });
    const opB = makeOp('clip-1', {
      type: 'add',
      vectorClock: makeClock({ u1: 1, u2: 2 }),
    });
    expect(detectConflict(opA, opB)).toBe(true);
  });
});

// ─── resolveConflict ──────────────────────────────────────────────

describe('resolveConflict', () => {
  const early = makeOp('clip-1', { timestamp: 100, userId: 'u1' });
  const late = makeOp('clip-1', { timestamp: 200, userId: 'u2' });

  it('returns empty for empty input', () => {
    expect(resolveConflict([], 'last-writer-wins')).toEqual([]);
  });

  it('returns single op unchanged', () => {
    expect(resolveConflict([early], 'last-writer-wins')).toEqual([early]);
  });

  it('last-writer-wins picks latest timestamp', () => {
    const result = resolveConflict([early, late], 'last-writer-wins');
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u2');
  });

  it('first-writer-wins picks earliest timestamp', () => {
    const result = resolveConflict([late, early], 'first-writer-wins');
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u1');
  });

  it('manual returns all operations', () => {
    const result = resolveConflict([early, late], 'manual');
    expect(result).toHaveLength(2);
  });

  it('merge keeps all add operations', () => {
    const addA = makeOp('clip-1', { type: 'add', timestamp: 100 });
    const addB = makeOp('clip-1', { type: 'add', timestamp: 200 });
    const result = resolveConflict([addA, addB], 'merge');
    expect(result).toHaveLength(2);
  });
});

// ─── batchOperations ──────────────────────────────────────────────

describe('batchOperations', () => {
  it('returns empty for empty input', () => {
    expect(batchOperations([], 1000)).toEqual([]);
  });

  it('groups ops within time window', () => {
    const ops = [
      makeOp('a', { timestamp: 100 }),
      makeOp('b', { timestamp: 200 }),
      makeOp('c', { timestamp: 300 }),
    ];
    const batches = batchOperations(ops, 500);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(3);
  });

  it('splits ops outside time window', () => {
    const ops = [
      makeOp('a', { timestamp: 100 }),
      makeOp('b', { timestamp: 2000 }),
    ];
    const batches = batchOperations(ops, 500);
    expect(batches).toHaveLength(2);
  });

  it('sorts ops by timestamp before batching', () => {
    const ops = [
      makeOp('b', { timestamp: 200 }),
      makeOp('a', { timestamp: 100 }),
    ];
    const batches = batchOperations(ops, 500);
    expect(batches[0][0].data.id).toBe('a');
  });
});

// ─── ConflictResolver ─────────────────────────────────────────────

describe('ConflictResolver', () => {
  it('tracks and resolves with default strategy', () => {
    const resolver = new ConflictResolver('last-writer-wins');
    resolver.track(makeOp('clip-1', { timestamp: 100, userId: 'u1' }));
    resolver.track(makeOp('clip-1', { timestamp: 200, userId: 'u2' }));
    const resolved = resolver.resolve();
    expect(resolved).toHaveLength(1);
    expect(resolved[0].userId).toBe('u2');
  });

  it('clears pending after resolve', () => {
    const resolver = new ConflictResolver();
    resolver.track(makeOp('clip-1'));
    resolver.resolve();
    expect(resolver.getPendingCount()).toBe(0);
  });

  it('records conflict history', () => {
    const resolver = new ConflictResolver('last-writer-wins');
    resolver.track(makeOp('clip-1', {
      timestamp: 100,
      vectorClock: makeClock({ u1: 2, u2: 1 }),
    }));
    resolver.track(makeOp('clip-1', {
      timestamp: 200,
      vectorClock: makeClock({ u1: 1, u2: 2 }),
    }));
    resolver.resolve();
    expect(resolver.getHistory()).toHaveLength(1);
    expect(resolver.getHistory()[0].resolution).toBe('last-writer-wins');
  });

  it('reset clears pending and history', () => {
    const resolver = new ConflictResolver();
    resolver.track(makeOp('clip-1'));
    resolver.resolve();
    resolver.reset();
    expect(resolver.getPendingCount()).toBe(0);
    expect(resolver.getHistory()).toHaveLength(0);
  });

  it('uses override strategy when provided', () => {
    const resolver = new ConflictResolver('last-writer-wins');
    resolver.track(makeOp('clip-1', { timestamp: 100 }));
    resolver.track(makeOp('clip-1', { timestamp: 200 }));
    const resolved = resolver.resolve('first-writer-wins');
    expect(resolved[0].userId).toBe('user-1');
  });
});
