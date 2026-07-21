import { describe, it, expect } from 'vitest';
import { formatNumber, formatDate, cn, categoryLabel } from '@/lib/utils';

describe('formatNumber', () => {
  it('formats millions', () => {
    expect(formatNumber(1_500_000)).toBe('1.5M');
  });

  it('formats thousands', () => {
    expect(formatNumber(15_400)).toBe('15.4K');
  });

  it('returns raw number below 1000', () => {
    expect(formatNumber(999)).toBe('999');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2026-07-15T00:00:00Z');
    // Should contain month, day, year
    expect(result).toMatch(/Jul/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });
});

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});

describe('categoryLabel', () => {
  it('returns correct labels', () => {
    expect(categoryLabel('effect')).toBe('Effect');
    expect(categoryLabel('transition')).toBe('Transition');
    expect(categoryLabel('generator')).toBe('Generator');
    expect(categoryLabel('analyzer')).toBe('Analyzer');
    expect(categoryLabel('other')).toBe('Other');
  });
});
