import type { ExpenseType } from '@/types/onboarding.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

/**
 * Compute the dominant category across a list of items.
 * Ties are broken by the earliest `createdAt` of items in the tied categories.
 *
 * Returns 'groceries' if `items` is empty.
 */
export function computeDominantCategory(items: ShoppingListItemResponse[]): ExpenseType {
  if (items.length === 0) return 'groceries';

  // Count items per category
  const counts = new Map<ExpenseType, number>();
  // Track earliest createdAt per category for tie-breaking
  const earliest = new Map<ExpenseType, string>();

  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    const prev = earliest.get(item.category);
    if (!prev || item.createdAt < prev) {
      earliest.set(item.category, item.createdAt);
    }
  }

  // Find category with max count; ties → earliest createdAt
  let winner: ExpenseType = 'groceries';
  let winnerCount = 0;
  let winnerEarliest = '￿';  // sentinel — any real ISO date sorts before this

  for (const [category, count] of counts) {
    const earliestForCat = earliest.get(category)!;
    if (count > winnerCount) {
      winner = category;
      winnerCount = count;
      winnerEarliest = earliestForCat;
    } else if (count === winnerCount && earliestForCat < winnerEarliest) {
      winner = category;
      winnerEarliest = earliestForCat;
    }
  }

  return winner;
}
