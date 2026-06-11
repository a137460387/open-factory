import { describe, expect, it } from 'vitest';
import { buildSubtitleTranslationBatches } from '../src';

describe('subtitle translation batching', () => {
  it('splits cues into batches of at most 50 while preserving order', () => {
    const cues = Array.from({ length: 121 }, (_, index) => ({ id: `cue-${index}`, text: `Line ${index}` }));

    const batches = buildSubtitleTranslationBatches(cues);

    expect(batches.map((batch) => batch.cues.length)).toEqual([50, 50, 21]);
    expect(batches.map((batch) => batch.startIndex)).toEqual([0, 50, 100]);
    expect(batches.flatMap((batch) => batch.cues.map((cue) => cue.id))).toEqual(cues.map((cue) => cue.id));
  });

  it('normalizes invalid batch sizes to one cue per batch', () => {
    const cues = [
      { id: 'cue-a', text: 'A' },
      { id: 'cue-b', text: 'B' }
    ];

    expect(buildSubtitleTranslationBatches(cues, 0).map((batch) => batch.cues)).toEqual([[cues[0]], [cues[1]]]);
    expect(buildSubtitleTranslationBatches(cues, Number.NaN).map((batch) => batch.cues)).toEqual([cues]);
  });
});
