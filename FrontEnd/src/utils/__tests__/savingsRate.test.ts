import { describe, it, expect } from 'vitest';
import { computeSavingsRate } from '../savingsRate';

describe('computeSavingsRate', () => {
  it('returns null when income is null', () => {
    expect(computeSavingsRate(null, 500)).toBeNull();
  });

  it('returns null when income is undefined', () => {
    expect(computeSavingsRate(undefined, 500)).toBeNull();
  });

  it('returns null when income is 0', () => {
    expect(computeSavingsRate(0, 500)).toBeNull();
  });

  it('returns null when income is negative', () => {
    expect(computeSavingsRate(-100, 0)).toBeNull();
  });

  it('computes (income - spend) / income for a normal case', () => {
    expect(computeSavingsRate(2000, 500)).toBeCloseTo(0.75);
  });

  it('returns 1 when nothing has been spent', () => {
    expect(computeSavingsRate(2000, 0)).toBe(1);
  });

  it('clamps to 0 when spend exceeds income (no negative rate)', () => {
    expect(computeSavingsRate(1000, 1500)).toBe(0);
  });

  it('clamps to 1 when spend is negative (no rate above 1)', () => {
    expect(computeSavingsRate(1000, -500)).toBe(1);
  });
});
