import { analyzePitchFrames, type ClipPitchDataPoint } from '@open-factory/editor-core';

export interface PitchAnalysisWorkerInput {
  samples: Float32Array;
  sampleRate: number;
}

export interface PitchAnalysisWorkerOutput {
  success: boolean;
  points: ClipPitchDataPoint[];
  error?: string;
}

self.onmessage = (event: MessageEvent<PitchAnalysisWorkerInput>) => {
  try {
    const { samples, sampleRate } = event.data;
    const points = analyzePitchFrames(samples, sampleRate, {
      frameSize: 4096,
      hopSize: 2048,
      minFrequency: 60,
      maxFrequency: 1200,
    });
    const payload: PitchAnalysisWorkerOutput = { success: true, points };
    self.postMessage(payload);
  } catch (error) {
    const payload: PitchAnalysisWorkerOutput = {
      success: false,
      points: [],
      error: error instanceof Error ? error.message : 'Pitch analysis failed',
    };
    self.postMessage(payload);
  }
};
