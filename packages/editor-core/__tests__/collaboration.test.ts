import { describe, expect, it } from 'vitest';
import {
  applyCollaborationReconnectState,
  assignCollaborationUserColors,
  buildCollaborationClipLocks,
  canApplyCollaborationOperation,
  parseCollaborationOperation,
  rebaseCollaborationOperations,
  serializeCollaborationOperation,
  type CollaborationOperation
} from '../src';
import { makeProject } from './test-utils';

describe('local network collaboration', () => {
  it('rebases later operations on the same clip after the first operation', () => {
    const operations: CollaborationOperation[] = [
      {
        id: 'op-late',
        userId: 'user-b',
        commandName: 'UpdateClipCommand',
        params: { transform: { x: 0.5 } },
        timestamp: 20,
        kind: 'timeline-command',
        clipId: 'clip-a'
      },
      {
        id: 'op-first',
        userId: 'user-a',
        commandName: 'MoveClipCommand',
        params: { start: 2 },
        timestamp: 10,
        kind: 'timeline-command',
        clipId: 'clip-a'
      }
    ];

    expect(rebaseCollaborationOperations(operations)).toEqual([
      expect.objectContaining({ id: 'op-first', rebased: false }),
      expect.objectContaining({ id: 'op-late', rebased: true, rebaseAfterOperationId: 'op-first' })
    ]);
  });

  it('overwrites the client project with the host state after reconnect', () => {
    const client = { ...makeProject(), id: 'client-project', updatedAt: '2026-06-01T00:00:00.000Z' };
    const host = { ...makeProject(), id: 'host-project', updatedAt: '2026-06-02T00:00:00.000Z' };

    expect(applyCollaborationReconnectState(client, host)).toEqual({
      project: host,
      overwritten: true,
      hostUpdatedAt: host.updatedAt
    });
  });

  it('rejects mutating commands for read-only clients while allowing comments and playhead presence', () => {
    expect(canApplyCollaborationOperation('read-only', { kind: 'timeline-command' })).toBe(false);
    expect(canApplyCollaborationOperation('read-only', { kind: 'comment' })).toBe(true);
    expect(canApplyCollaborationOperation('read-only', { kind: 'playhead' })).toBe(true);
    expect(canApplyCollaborationOperation('edit', { kind: 'timeline-command' })).toBe(true);
  });

  it('assigns deterministic colors to multiple user playheads', () => {
    expect(
      assignCollaborationUserColors([
        { userId: 'host', name: 'Host', playheadTime: 1 },
        { userId: 'client', name: 'Client', playheadTime: 2, color: 'f59e0b' }
      ])
    ).toEqual([
      { userId: 'host', name: 'Host', playheadTime: 1, color: '#38bdf8' },
      { userId: 'client', name: 'Client', playheadTime: 2, color: '#f59e0b' }
    ]);
  });

  it('builds clip locks from recent remote timeline operations', () => {
    const locks = buildCollaborationClipLocks(
      [
        {
          id: 'old',
          userId: 'user-a',
          commandName: 'UpdateClipCommand',
          params: {},
          timestamp: 100,
          kind: 'timeline-command',
          clipId: 'clip-a'
        },
        {
          id: 'recent',
          userId: 'user-b',
          commandName: 'UpdateClipCommand',
          params: {},
          timestamp: 1_000,
          kind: 'timeline-command',
          clipId: 'clip-b'
        }
      ],
      [{ userId: 'user-b', name: 'Client B', playheadTime: 0 }],
      500,
      1_100
    );

    expect(locks).toEqual([{ clipId: 'clip-b', userId: 'user-b', userName: 'Client B', updatedAt: 1_000 }]);
  });

  it('serializes and parses operation envelopes', () => {
    const operation: CollaborationOperation = {
      id: 'op-1',
      userId: 'user-a',
      commandName: 'UpdateClipCommand',
      params: { clipId: 'clip-a' },
      timestamp: 10,
      kind: 'timeline-command',
      clipId: 'clip-a'
    };

    expect(parseCollaborationOperation(serializeCollaborationOperation(operation))).toEqual(operation);
    expect(parseCollaborationOperation('{')).toBeUndefined();
  });
});
