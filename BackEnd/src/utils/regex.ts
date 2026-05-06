// Escape user input so it can be safely embedded in a MongoDB $regex filter.
// Without this, characters like `.`, `*`, `(`, `[` would be interpreted as regex
// metacharacters and either match too broadly or throw a SyntaxError.
const REGEX_METACHARS = /[.*+?^${}()|[\]\\]/g;

export function escapeRegex(input: string): string {
  return input.replace(REGEX_METACHARS, '\\$&');
}
