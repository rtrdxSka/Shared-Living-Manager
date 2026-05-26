/**
 * Savings rate = (income − spend) / income, clamped to [0, 1].
 *
 * Returns `null` when income is missing or non-positive — there's no
 * meaningful rate to show until income is set. Mirrors the household budget
 * page's "set income to see your savings rate" affordance.
 *
 * Both the personal (your income − your share) and household (combined income −
 * household spend) savings rates are computed with this single helper; the
 * caller decides which income/spend pair to pass.
 */
export function computeSavingsRate(
  income: number | null | undefined,
  spend: number
): number | null {
  if (income == null || income <= 0) return null;
  return Math.max(0, Math.min(1, (income - spend) / income));
}
