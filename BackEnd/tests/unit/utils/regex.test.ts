import { describe, it, expect } from 'vitest';
import { escapeRegex } from '../../../src/utils/regex';

describe('escapeRegex', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegex('a.b*c[d]')).toBe('a\\.b\\*c\\[d\\]');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeRegex('hello world')).toBe('hello world');
  });

  it('returns a pattern that matches the literal input', () => {
    const literal = 'foo.bar';
    const re = new RegExp(escapeRegex(literal));
    expect(re.test('foo.bar')).toBe(true);
    expect(re.test('fooXbar')).toBe(false);
  });
});
