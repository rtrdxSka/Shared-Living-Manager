import { describe, it, expect } from 'vitest';
import { extractApiError } from '../extractApiError';

describe('extractApiError', () => {
  it('returns the message from an axios error response', () => {
    const err = {
      isAxiosError: true,
      response: { data: { message: 'Email already in use' } },
    };
    expect(extractApiError(err, 'fallback')).toBe('Email already in use');
  });

  it('returns fallback when error has no axios shape', () => {
    expect(extractApiError(new Error('plain'), 'Something went wrong')).toBe(
      'Something went wrong',
    );
  });

  it('returns fallback when axios error has no message field', () => {
    const err = { isAxiosError: true, response: { data: {} } };
    expect(extractApiError(err, 'fallback')).toBe('fallback');
  });

  it('returns fallback for non-error values (undefined, string, null)', () => {
    expect(extractApiError(undefined, 'F')).toBe('F');
    expect(extractApiError('string', 'F')).toBe('F');
    expect(extractApiError(null, 'F')).toBe('F');
  });
});
