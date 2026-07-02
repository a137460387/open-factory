import { describe, expect, it } from 'vitest';
import { mergeProjectSpeakers } from '../src/project/project-speakers';

describe('mergeProjectSpeakers', () => {
  it('merges imported speakers without duplicating existing names (case-insensitive)', () => {
    const existing = [
      { id: 's1', name: 'Alice' },
      { id: 's2', name: 'Bob' },
    ];
    const imported = [
      { id: 's3', name: 'alice' },
      { id: 's4', name: 'Charlie' },
    ];
    const result = mergeProjectSpeakers(existing, imported);
    const names = result.map((s) => s.name.toLowerCase());
    expect(names).toContain('alice');
    expect(names).toContain('bob');
    expect(names).toContain('charlie');
    // alice should not appear twice
    expect(names.filter((n) => n === 'alice')).toHaveLength(1);
  });
});

