import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { EXPENSE_TYPE_LABELS } from '@/types/onboarding.types';
import type { ExpenseType } from '@/types/onboarding.types';
import type { BoughtState } from '@/types/shoppingList.types';

const DEBOUNCE_MS = 500;
const ALL_CATEGORIES = Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[];

export interface ShoppingFilterBarProps {
  search: string;
  onSearchChange: (s: string) => void;
  selectedCategories: ExpenseType[];
  onToggleCategory: (cat: ExpenseType) => void;
  boughtState?: BoughtState;
  onBoughtStateChange?: (s: BoughtState) => void;
}

export default function ShoppingFilterBar({
  search,
  onSearchChange,
  selectedCategories,
  onToggleCategory,
  boughtState,
  onBoughtStateChange,
}: ShoppingFilterBarProps) {
  // Local state mirrors the input so typing feels instant; debounced value
  // flows up to the parent on each idle period.
  const [localSearch, setLocalSearch] = useState(search);
  const debounced = useDebouncedValue(localSearch, DEBOUNCE_MS);

  useEffect(() => {
    if (debounced !== search) onSearchChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Keep local in sync if the parent resets it externally (e.g. tab switch).
  useEffect(() => {
    if (search !== localSearch && search !== debounced) {
      setLocalSearch(search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const showBoughtToggle = boughtState !== undefined && onBoughtStateChange !== undefined;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search items..."
          className="pl-9"
          maxLength={120}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((cat) => {
          const selected = selectedCategories.includes(cat);
          return (
            <Badge
              key={cat}
              variant={selected ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => onToggleCategory(cat)}
            >
              {EXPENSE_TYPE_LABELS[cat]}
            </Badge>
          );
        })}
      </div>

      {showBoughtToggle && (
        <div className="inline-flex rounded-md border bg-background p-0.5">
          {(['all', 'unbought', 'bought'] as BoughtState[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={boughtState === s ? 'default' : 'ghost'}
              className="h-7 px-3 text-xs"
              onClick={() => onBoughtStateChange!(s)}
            >
              {s === 'all' ? 'All' : s === 'unbought' ? 'Unbought' : 'Bought'}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
