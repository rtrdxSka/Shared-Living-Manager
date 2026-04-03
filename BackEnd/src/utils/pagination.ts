import { IPaginationInput, IPaginatedResult } from '../types/pagination.types';

export function parsePaginationParams(input: IPaginationInput): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
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
