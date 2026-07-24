import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initInferenceGuard,
  getActiveProvider,
  checkFeatureStatus,
  withInferenceGuard,
  withInferenceGuardSync,
  InferenceFeatureDegradedError,
  ASR_GUARD,
  SEMANTIC_GUARD,
  VISION_GUARD,
} from './inference-guard';
import { HeuristicProvider, LocalInferenceProvider } from './inference-provider';

describe('InferenceGuard', () => {
  beforeEach(() => {
    // Reset global state
    initInferenceGuard(null);
  });

  describe('initInferenceGuard', () => {
    it('sets the global provider', () => {
      const provider = new HeuristicProvider();
      initInferenceGuard(provider);
      expect(getActiveProvider()).toBe(provider);
    });

    it('accepts null to clear the provider', () => {
      initInferenceGuard(new HeuristicProvider());
      initInferenceGuard(null);
      expect(getActiveProvider()).toBeNull();
    });
  });

  describe('checkFeatureStatus', () => {
    it('returns unavailable when no provider', () => {
      const status = checkFeatureStatus(ASR_GUARD);
      expect(status.available).toBe(false);
      expect(status.reason).toContain('未初始化');
    });

    it('returns unavailable when provider lacks capability', () => {
      initInferenceGuard(new HeuristicProvider());
      // HeuristicProvider only has 'scene-detection'
      const status = checkFeatureStatus(ASR_GUARD);
      expect(status.available).toBe(false);
      expect(status.reason).toContain('不支持此能力');
    });

    it('returns available when provider has capability', () => {
      initInferenceGuard(new HeuristicProvider());
      const status = checkFeatureStatus({
        capability: 'scene-detection',
        featureName: '场景检测',
      });
      expect(status.available).toBe(true);
    });
  });

  describe('withInferenceGuard', () => {
    it('throws InferenceFeatureDegradedError when no provider', async () => {
      await expect(
        withInferenceGuard(ASR_GUARD, async () => 'result'),
      ).rejects.toThrow(InferenceFeatureDegradedError);
    });

    it('throws when provider lacks capability', async () => {
      initInferenceGuard(new HeuristicProvider());
      await expect(
        withInferenceGuard(ASR_GUARD, async () => 'result'),
      ).rejects.toThrow('语音识别');
    });

    it('executes operation when provider is ready', async () => {
      initInferenceGuard(new HeuristicProvider());
      const result = await withInferenceGuard(
        { capability: 'scene-detection', featureName: '场景检测' },
        async () => 'success',
      );
      expect(result).toBe('success');
    });

    it('wraps operation errors in InferenceFeatureDegradedError', async () => {
      initInferenceGuard(new HeuristicProvider());
      await expect(
        withInferenceGuard(
          { capability: 'scene-detection', featureName: '场景检测' },
          async () => { throw new Error('operation failed'); },
        ),
      ).rejects.toThrow(InferenceFeatureDegradedError);
    });

    it('passes provider to operation', async () => {
      const provider = new HeuristicProvider();
      initInferenceGuard(provider);
      let receivedProvider: any = null;
      await withInferenceGuard(
        { capability: 'scene-detection', featureName: '场景检测' },
        async (p) => { receivedProvider = p; },
      );
      expect(receivedProvider).toBe(provider);
    });
  });

  describe('withInferenceGuardSync', () => {
    it('throws when no provider', () => {
      expect(() =>
        withInferenceGuardSync(ASR_GUARD, () => 'result'),
      ).toThrow(InferenceFeatureDegradedError);
    });

    it('executes when provider is ready', () => {
      initInferenceGuard(new HeuristicProvider());
      const result = withInferenceGuardSync(
        { capability: 'scene-detection', featureName: '场景检测' },
        () => 'success',
      );
      expect(result).toBe('success');
    });
  });

  describe('InferenceFeatureDegradedError', () => {
    it('has correct name and featureName', () => {
      const error = new InferenceFeatureDegradedError('test-feature', 'reason');
      expect(error.name).toBe('InferenceFeatureDegradedError');
      expect(error.featureName).toBe('test-feature');
      expect(error.message).toContain('test-feature');
      expect(error.message).toContain('reason');
    });
  });

  describe('pre-configured guards', () => {
    it('ASR_GUARD has correct capability', () => {
      expect(ASR_GUARD.capability).toBe('asr');
      expect(ASR_GUARD.featureName).toContain('语音');
    });

    it('SEMANTIC_GUARD has correct capability', () => {
      expect(SEMANTIC_GUARD.capability).toBe('semantic');
    });

    it('VISION_GUARD has correct capability', () => {
      expect(VISION_GUARD.capability).toBe('vision');
    });
  });
});
