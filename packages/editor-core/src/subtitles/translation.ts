export interface SubtitleTranslationCue {
  id: string;
  text: string;
}

export interface SubtitleTranslationBatch {
  startIndex: number;
  cues: SubtitleTranslationCue[];
}

export function buildSubtitleTranslationBatches(cues: SubtitleTranslationCue[], maxBatchSize = 50): SubtitleTranslationBatch[] {
  const batchSize = Number.isFinite(maxBatchSize) ? Math.max(1, Math.floor(maxBatchSize)) : 50;
  const batches: SubtitleTranslationBatch[] = [];
  for (let index = 0; index < cues.length; index += batchSize) {
    batches.push({
      startIndex: index,
      cues: cues.slice(index, index + batchSize)
    });
  }
  return batches;
}
