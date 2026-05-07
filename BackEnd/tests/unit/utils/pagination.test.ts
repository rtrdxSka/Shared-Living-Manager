import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  clampLimit,
  parsePaginationParams,
  buildPaginatedResult,
  encodeDateIdCursor,
  parseDateIdCursor,
} from '../../../src/utils/pagination';
import { AppError } from '../../../src/utils/error';

describe('pagination constants', () => {
  it('DEFAULT_PAGE_SIZE is 20 and MAX_PAGE_SIZE is 100', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});

describe('clampLimit', () => {
  it('returns the input when it is a finite integer within range', () => {
    expect(clampLimit(25)).toBe(25);
  });

  it('floors fractional inputs', () => {
    expect(clampLimit(15.9)).toBe(15);
  });

  it('parses numeric strings', () => {
    expect(clampLimit('30')).toBe(30);
  });

  it('clamps values above MAX_PAGE_SIZE down to MAX_PAGE_SIZE', () => {
    expect(clampLimit(9999)).toBe(MAX_PAGE_SIZE);
  });

  it('clamps values below 1 up to 1', () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
  });

  it('falls back to DEFAULT_PAGE_SIZE for non-finite / non-numeric values', () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit('not-a-number')).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(NaN)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(Infinity)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(-Infinity)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('coerces null to 0 (Number(null) === 0) and clamps it up to 1', () => {
    // Documents the JS coercion quirk: Number(null) === 0 (finite),
    // so clampLimit takes the lower-bound path rather than the NaN fallback.
    expect(clampLimit(null)).toBe(1);
  });
});

describe('parsePaginationParams', () => {
  it('returns sensible defaults when both page and limit are absent', () => {
    expect(parsePaginationParams({})).toEqual({
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
      skip: 0,
    });
  });

  it('computes skip as (page - 1) * limit', () => {
    expect(parsePaginationParams({ page: 3, limit: 25 })).toEqual({
      page: 3,
      limit: 25,
      skip: 50,
    });
  });

  it('clamps page to a minimum of 1', () => {
    const result = parsePaginationParams({ page: 0, limit: 10 });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('clamps a negative page to 1', () => {
    const result = parsePaginationParams({ page: -5, limit: 10 });
    expect(result.page).toBe(1);
  });

  it('clamps limit to MAX_PAGE_SIZE for oversized requests', () => {
    const result = parsePaginationParams({ page: 1, limit: 9999 });
    expect(result.limit).toBe(MAX_PAGE_SIZE);
  });

  it('clamps limit to 1 when zero or negative', () => {
    expect(parsePaginationParams({ page: 1, limit: 0 }).limit).toBe(1);
    expect(parsePaginationParams({ page: 1, limit: -3 }).limit).toBe(1);
  });
});

describe('buildPaginatedResult', () => {
  it('echoes items, total and page; computes totalPages via ceil(total/limit)', () => {
    const items = [{ a: 1 }, { a: 2 }, { a: 3 }];
    const result = buildPaginatedResult(items, 47, 2, 10);
    expect(result.items).toBe(items);
    expect(result.total).toBe(47);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(5);
  });

  it('returns at least 1 totalPage when there are zero results', () => {
    const result = buildPaginatedResult<number>([], 0, 1, 10);
    expect(result.totalPages).toBe(1);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns totalPages = 1 when total <= limit', () => {
    const result = buildPaginatedResult([1, 2, 3], 3, 1, 10);
    expect(result.totalPages).toBe(1);
  });
});

describe('encodeDateIdCursor / parseDateIdCursor', () => {
  it('encodes a date and an ObjectId-like value as "<isoDate>|<idHex>"', () => {
    const date = new Date('2026-04-01T12:34:56.000Z');
    const id = new Types.ObjectId();
    const cursor = encodeDateIdCursor(date, id);
    expect(cursor).toBe(`${date.toISOString()}|${id.toString()}`);
  });

  it('round-trips a valid cursor through parseDateIdCursor', () => {
    const date = new Date('2026-04-01T12:34:56.000Z');
    const id = new Types.ObjectId();
    const cursor = encodeDateIdCursor(date, id);
    const parsed = parseDateIdCursor(cursor);
    expect(parsed.date.toISOString()).toBe(date.toISOString());
    expect(parsed.id).toBe(id.toString());
  });

  it('throws an AppError(400) for cursors without exactly two parts', () => {
    try {
      parseDateIdCursor('only-one-part');
      throw new Error('expected parseDateIdCursor to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it('throws AppError for an invalid date portion', () => {
    const validId = new Types.ObjectId().toString();
    expect(() => parseDateIdCursor(`not-a-date|${validId}`)).toThrowError(AppError);
  });

  it('throws AppError for a non-ObjectId-hex id portion', () => {
    const date = new Date('2026-04-01T12:34:56.000Z').toISOString();
    expect(() => parseDateIdCursor(`${date}|not-an-objectid`)).toThrowError(AppError);
  });

  it('throws AppError for cursors with more than two parts', () => {
    const date = new Date('2026-04-01T12:34:56.000Z').toISOString();
    const id = new Types.ObjectId().toString();
    expect(() => parseDateIdCursor(`${date}|${id}|extra`)).toThrowError(AppError);
  });
});
