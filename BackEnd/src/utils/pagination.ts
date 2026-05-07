import { IPaginationInput, IPaginatedResult } from '../types/pagination.types';
import { BadRequestError } from './error';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Clamps a limit value into [1, MAX_PAGE_SIZE]. NaN / non-finite inputs fall
 * back to DEFAULT_PAGE_SIZE.
 *
 * Caveat: Number(null) === 0 and Number(false) === 0 are FINITE, so they
 * clamp to 1 instead of returning DEFAULT_PAGE_SIZE. Same for any input that
 * coerces to <= 0 (e.g. negative numbers). HTTP routes are protected by the
 * `.isInt({ min: 1, max: 100 })` validator chain, so this only matters if you
 * call clampLimit directly from a service or script. Validate the input range
 * upstream before calling.
 */
export function clampLimit(raw: unknown): number {
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(parsed)));
}

export function parsePaginationParams(input: IPaginationInput): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, input.limit ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): IPaginatedResult<T> {
  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

// Cursor helpers ── pipe-delimited "<isoDate>|<objectIdHex>" tokens.
// Pipe-delimited matches the existing shopping-list cursor convention; keeps
// tokens short and readable. Resources with extra cursor fields encode their
// own format alongside these (see shopping-list.service for an example).

export function encodeDateIdCursor(date: Date, id: { toString(): string }): string {
  return `${date.toISOString()}|${id.toString()}`;
}

export function parseDateIdCursor(raw: string): { date: Date; id: string } {
  const parts = raw.split('|');
  if (parts.length !== 2) throw BadRequestError('Invalid cursor');
  const [dateStr, idStr] = parts;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) throw BadRequestError('Invalid cursor');
  if (!/^[a-fA-F0-9]{24}$/.test(idStr)) throw BadRequestError('Invalid cursor');
  return { date, id: idStr };
}
