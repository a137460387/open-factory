import { describe, expect, it } from 'vitest';
import { shouldWarnUnsupportedConcurrency, RENDER_DEFAULT_CONCURRENCY } from './render';

describe('shouldWarnUnsupportedConcurrency', () => {
  it('warns when a non-default concurrency value is passed', () => {
    expect(shouldWarnUnsupportedConcurrency('8')).toBe(true);
    expect(shouldWarnUnsupportedConcurrency('1')).toBe(true);
    expect(shouldWarnUnsupportedConcurrency('0')).toBe(true);
  });

  it('does not warn for the default value', () => {
    expect(shouldWarnUnsupportedConcurrency(String(RENDER_DEFAULT_CONCURRENCY))).toBe(false);
    expect(shouldWarnUnsupportedConcurrency('4')).toBe(false);
  });

  it('does not warn when the option is not passed', () => {
    expect(shouldWarnUnsupportedConcurrency(undefined)).toBe(false);
    expect(shouldWarnUnsupportedConcurrency('')).toBe(false);
  });

  it('does not warn for non-numeric values', () => {
    expect(shouldWarnUnsupportedConcurrency('auto')).toBe(false);
    expect(shouldWarnUnsupportedConcurrency('abc')).toBe(false);
  });
});
