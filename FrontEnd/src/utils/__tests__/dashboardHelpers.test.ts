import { describe, it, expect } from 'vitest';
import {
  fmt,
  stepMonth,
  formatMonthLabel,
  currentMonthString,
  getDueDateStatus,
  formatDueDate,
} from '../dashboardHelpers';

describe('fmt', () => {
  it('formats integers without decimals', () => {
    expect(fmt(1200)).toBe('1,200');
  });
  it('rounds to 2 decimals', () => {
    expect(fmt(12.345)).toBe('12.35');
  });
  it('preserves trailing significant digit', () => {
    expect(fmt(12.4)).toBe('12.4');
  });
});

describe('stepMonth', () => {
  it('moves forward', () => {
    expect(stepMonth('2026-04', 'next')).toBe('2026-05');
  });
  it('moves backward across year boundary', () => {
    expect(stepMonth('2026-01', 'prev')).toBe('2025-12');
  });
});

describe('formatMonthLabel', () => {
  it('formats a YYYY-MM string to a human label', () => {
    expect(formatMonthLabel('2026-05')).toMatch(/May 2026/);
  });
});

describe('currentMonthString', () => {
  it('returns YYYY-MM for the current month', () => {
    expect(currentMonthString()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('getDueDateStatus', () => {
  it('returns "none" when dueDate is undefined', () => {
    expect(getDueDateStatus(undefined, false)).toBe('none');
  });
  it('returns "overdue" for a past date on incomplete task', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(getDueDateStatus(yesterday, false)).toBe('overdue');
  });
  it('returns "due-today" for today', () => {
    expect(getDueDateStatus(new Date().toISOString(), false)).toBe('due-today');
  });
  it('returns "upcoming" for a future date', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(getDueDateStatus(tomorrow, false)).toBe('upcoming');
  });
  it('returns "none" for completed tasks regardless of date', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(getDueDateStatus(yesterday, true)).toBe('none');
  });
});

describe('formatDueDate', () => {
  it('returns a non-empty human-readable string for tomorrow', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const out = formatDueDate(tomorrow);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});
