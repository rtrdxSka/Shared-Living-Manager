export interface IPaginationInput {
  page?: number;
  limit?: number;
}

export interface IPaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}
