import { describe, it, expect } from 'vitest';
import type { AIUsageRecord } from '../src/ai-service';
import type { AIFeatureUsageRecord } from '../src/ai-usage-stats';
import {
  aggregateByProvider,
  aggregateByFeature,
  aggregateDailyTrend,
  generateRecommendations,
  calculateMonthlyCost,
  checkCostAlert,
  getUsedFeatures,
  RECOMMENDATION_RULES,
} from '../src/ai-usage-stats';

function makeProviderRecord(overrides: Partial<AIUsageRecord> = {}): AIUsageRecord {
  return {
    providerId: 'openai',
    timestamp: Date.now(),
    inputTokens: 100,
    outputTokens: 200,
    estimatedCostCny: 0.05,
    ...overrides,
  };
}

function makeFeatureRecord(overrides: Partial<AIFeatureUsageRecord> = {}): AIFeatureUsageRecord {
  return {
    providerId: 'openai',
    timestamp: Date.now(),
    inputTokens: 100,
    outputTokens: 200,
    estimatedCostCny: 0.05,
    service: 'subtitle-polish',
    ...overrides,
  };
}

describe('aggregateByProvider', () => {
  it('groups records by providerId and sums correctly', () => {
    const records: AIUsageRecord[] = [
      makeProviderRecord({ providerId: 'openai', inputTokens: 100, outputTokens: 200, estimatedCostCny: 0.1 }),
      makeProviderRecord({ providerId: 'openai', inputTokens: 50, outputTokens: 100, estimatedCostCny: 0.05 }),
      makeProviderRecord({ providerId: 'anthropic', inputTokens: 300, outputTokens: 400, estimatedCostCny: 0.3 }),
    ];
    const result = aggregateByProvider(records);
    expect(result).toHaveLength(2);
    // sorted by callCount desc: openai=2, anthropic=1
    expect(result[0].providerId).toBe('openai');
    expect(result[0].callCount).toBe(2);
    expect(result[0].totalInputTokens).toBe(150);
    expect(result[0].totalOutputTokens).toBe(300);
    expect(result[0].totalCostCny).toBeCloseTo(0.15);
    expect(result[1].providerId).toBe('anthropic');
    expect(result[1].callCount).toBe(1);
    expect(result[1].totalInputTokens).toBe(300);
    expect(result[1].totalOutputTokens).toBe(400);
  });

  it('returns empty array for empty input', () => {
    expect(aggregateByProvider([])).toEqual([]);
  });
});

describe('aggregateByFeature', () => {
  it('groups records by service and sums correctly', () => {
    const records: AIFeatureUsageRecord[] = [
      makeFeatureRecord({ service: 'subtitle-polish', inputTokens: 100, estimatedCostCny: 0.1 }),
      makeFeatureRecord({ service: 'subtitle-polish', inputTokens: 50, estimatedCostCny: 0.05 }),
      makeFeatureRecord({ service: 'rough-cut', inputTokens: 200, estimatedCostCny: 0.2 }),
    ];
    const result = aggregateByFeature(records);
    expect(result).toHaveLength(2);
    expect(result[0].service).toBe('subtitle-polish');
    expect(result[0].callCount).toBe(2);
    expect(result[0].totalInputTokens).toBe(150);
    expect(result[0].totalCostCny).toBeCloseTo(0.15);
    expect(result[1].service).toBe('rough-cut');
    expect(result[1].callCount).toBe(1);
  });

  it('returns empty array for empty input', () => {
    expect(aggregateByFeature([])).toEqual([]);
  });
});

describe('aggregateDailyTrend', () => {
  it('returns exactly 30 points by default', () => {
    const result = aggregateDailyTrend([]);
    expect(result).toHaveLength(30);
  });

  it('fills gaps with zeros for days with no usage', () => {
    const now = new Date('2026-06-27T12:00:00Z').getTime();
    // place one record 5 days ago
    const fiveDaysAgo = new Date('2026-06-22T10:00:00Z').getTime();
    const records: AIFeatureUsageRecord[] = [
      makeFeatureRecord({ timestamp: fiveDaysAgo, estimatedCostCny: 1.0 }),
    ];
    const result = aggregateDailyTrend(records, 30, now);
    expect(result).toHaveLength(30);
    // only one day should have nonzero count
    const nonZero = result.filter((p) => p.callCount > 0);
    expect(nonZero).toHaveLength(1);
    expect(nonZero[0].date).toBe('2026-06-22');
    expect(nonZero[0].totalCostCny).toBeCloseTo(1.0);
    // all others should be 0
    const zeros = result.filter((p) => p.callCount === 0);
    expect(zeros).toHaveLength(29);
  });

  it('respects custom days parameter', () => {
    const result = aggregateDailyTrend([], 7);
    expect(result).toHaveLength(7);
  });
});

describe('generateRecommendations', () => {
  it('returns empty for no used features', () => {
    expect(generateRecommendations([])).toEqual([]);
  });

  it('returns empty if all recommended features are already used', () => {
    const used = RECOMMENDATION_RULES.map((r) => r.requiresFeature).concat(
      RECOMMENDATION_RULES.map((r) => r.recommendFeature)
    );
    expect(generateRecommendations(used)).toEqual([]);
  });

  it('caps at maxRecommendations (default 3)', () => {
    // use enough features to trigger more than 3 rules
    const used = ['subtitle-polish', 'rough-cut', 'vision-analysis', 'chapter-title', 'chat-editor'];
    const result = generateRecommendations(used);
    expect(result).toHaveLength(3);
  });

  it('each rule triggers correctly with a single required feature', () => {
    for (const rule of RECOMMENDATION_RULES) {
      const result = generateRecommendations([rule.requiresFeature]);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].feature).toBe(rule.recommendFeature);
      expect(result[0].reasonKey).toBe(rule.reasonKey);
    }
  });

  it('does not recommend features the user has already used', () => {
    // if user used both subtitle-polish and contextual-translation
    const result = generateRecommendations(['subtitle-polish', 'contextual-translation']);
    const features = result.map((r) => r.feature);
    expect(features).not.toContain('contextual-translation');
  });

  it('does not produce duplicate recommendations', () => {
    const used = ['subtitle-polish', 'rough-cut', 'vision-analysis'];
    const result = generateRecommendations(used);
    const features = result.map((r) => r.feature);
    expect(new Set(features).size).toBe(features.length);
  });
});

describe('calculateMonthlyCost', () => {
  it('sums only records from the current calendar month', () => {
    // use a fixed now: 2026-06-27
    const now = new Date('2026-06-27T12:00:00Z').getTime();
    const june15 = new Date('2026-06-15T10:00:00Z').getTime();
    const june20 = new Date('2026-06-20T10:00:00Z').getTime();
    const may30 = new Date('2026-05-30T10:00:00Z').getTime();
    const records: AIUsageRecord[] = [
      makeProviderRecord({ timestamp: june15, estimatedCostCny: 1.0 }),
      makeProviderRecord({ timestamp: june20, estimatedCostCny: 2.5 }),
      makeProviderRecord({ timestamp: may30, estimatedCostCny: 5.0 }),
    ];
    expect(calculateMonthlyCost(records, now)).toBeCloseTo(3.5);
  });

  it('returns 0 for empty records', () => {
    expect(calculateMonthlyCost([], Date.now())).toBe(0);
  });
});

describe('checkCostAlert', () => {
  it('returns true when monthly cost exceeds threshold', () => {
    const now = new Date('2026-06-27T12:00:00Z').getTime();
    const june15 = new Date('2026-06-15T10:00:00Z').getTime();
    const records: AIUsageRecord[] = [
      makeProviderRecord({ timestamp: june15, estimatedCostCny: 50 }),
    ];
    expect(checkCostAlert(records, 30, now)).toBe(true);
  });

  it('returns false when monthly cost is below threshold', () => {
    const now = new Date('2026-06-27T12:00:00Z').getTime();
    const june15 = new Date('2026-06-15T10:00:00Z').getTime();
    const records: AIUsageRecord[] = [
      makeProviderRecord({ timestamp: june15, estimatedCostCny: 5 }),
    ];
    expect(checkCostAlert(records, 100, now)).toBe(false);
  });

  it('returns false when threshold is 0 (never alerts)', () => {
    const now = new Date('2026-06-27T12:00:00Z').getTime();
    const june15 = new Date('2026-06-15T10:00:00Z').getTime();
    const records: AIUsageRecord[] = [
      makeProviderRecord({ timestamp: june15, estimatedCostCny: 9999 }),
    ];
    expect(checkCostAlert(records, 0, now)).toBe(false);
  });
});

describe('getUsedFeatures', () => {
  it('returns deduplicated list of services', () => {
    const records: AIFeatureUsageRecord[] = [
      makeFeatureRecord({ service: 'subtitle-polish' }),
      makeFeatureRecord({ service: 'rough-cut' }),
      makeFeatureRecord({ service: 'subtitle-polish' }),
      makeFeatureRecord({ service: 'chat-editor' }),
    ];
    const result = getUsedFeatures(records);
    expect(result).toHaveLength(3);
    expect(result).toContain('subtitle-polish');
    expect(result).toContain('rough-cut');
    expect(result).toContain('chat-editor');
  });

  it('returns empty for no records', () => {
    expect(getUsedFeatures([])).toEqual([]);
  });
});
