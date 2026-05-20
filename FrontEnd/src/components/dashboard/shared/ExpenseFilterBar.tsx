import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { EXPENSE_TYPE_LABELS } from '@/types/onboarding.types';
import type { ExpenseType } from '@/types/onboarding.types';
import type { ExpenseFilters, ExpenseStatusFilter } from '@/types/expense.types';
import type { HouseholdMemberResponse } from '@/types/household.types';

const DEBOUNCE_MS = 500;
const ALL_CATEGORIES = Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[];
const STATUS_OPTIONS: { value: ExpenseStatusFilter; label: string }[] = [
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
];

export interface ExpenseFilterBarProps {
  filters: ExpenseFilters;
  onFiltersChange: (next: ExpenseFilters) => void;
  members: HouseholdMemberResponse[];
}

export default function ExpenseFilterBar({
  filters,
  onFiltersChange,
  members,
}: ExpenseFilterBarProps) {
  // Local state mirrors the input so typing feels instant; the debounced
  // value flows up to the parent on each idle period.
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debounced = useDebouncedValue(localSearch, DEBOUNCE_MS);

  useEffect(() => {
    if (debounced !== filters.search) {
      onFiltersChange({ ...filters, search: debounced });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Keep local in sync if the parent resets it externally.
  useEffect(() => {
    if (filters.search !== localSearch && filters.search !== debounced) {
      setLocalSearch(filters.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  function toggleCategory(cat: ExpenseType) {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onFiltersChange({ ...filters, categories: next });
  }

  function togglePayer(memberUserId: string) {
    const next = filters.paidBy.includes(memberUserId)
      ? filters.paidBy.filter((id) => id !== memberUserId)
      : [...filters.paidBy, memberUserId];
    onFiltersChange({ ...filters, paidBy: next });
  }

  function toggleStatus(s: ExpenseStatusFilter) {
    onFiltersChange({ ...filters, status: filters.status === s ? null : s });
  }

  const payerCandidates = members.filter((m) => m.userId && m.participatesInFinances);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search descriptions..."
          className="pl-9"
          maxLength={120}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((cat) => {
          const selected = filters.categories.includes(cat);
          return (
            <Badge
              key={cat}
              variant={selected ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggleCategory(cat)}
            >
              {EXPENSE_TYPE_LABELS[cat]}
            </Badge>
          );
        })}
      </div>

      {payerCandidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-3">Paid by</span>
          {payerCandidates.map((m) => {
            const selected = m.userId ? filters.paidBy.includes(m.userId) : false;
            return (
              <Badge
                key={m._id}
                variant={selected ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => m.userId && togglePayer(m.userId)}
              >
                {m.nickname}
              </Badge>
            );
          })}
        </div>
      )}

      <div className="inline-flex rounded-md border bg-background p-0.5">
        {STATUS_OPTIONS.map((s) => (
          <Button
            key={s.value}
            size="sm"
            variant={filters.status === s.value ? 'default' : 'ghost'}
            className="h-7 px-3 text-xs"
            onClick={() => toggleStatus(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
