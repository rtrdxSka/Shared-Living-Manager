import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoneyAmount } from '@/components/ui/money-amount';
import type { BudgetCategories } from '@/types/budget.types';
import type { ExpenseType } from '@/types/onboarding.types';

interface Props {
  category: ExpenseType;
  label: string;
  budgeted: number | undefined;
  spent: number;
  canEdit: boolean;
  isSaving: boolean;
  onSave: (next: BudgetCategories) => void;
  currentCategories: BudgetCategories;
  currency?: string;
  byMemberSplit?: {
    myNickname: string;
    partnerNickname: string;
    /** Undefined in joint mode (pool is shared, share is moot). */
    share?: { myAmount: number; partnerAmount: number };
    /** Always present. */
    paid: { myAmount: number; partnerAmount: number };
  };
}

export default function CategoryBudgetRow({
  category,
  label,
  budgeted,
  spent,
  canEdit,
  isSaving,
  onSave,
  currentCategories,
  currency,
  byMemberSplit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(budgeted?.toString() ?? '');

  const pct = budgeted && budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0;
  const over = typeof budgeted === 'number' && spent > budgeted;

  const handleSave = () => {
    const parsed = draft.trim() === '' ? undefined : Number(draft);
    if (parsed !== undefined && (Number.isNaN(parsed) || parsed < 0)) return;
    const next: BudgetCategories = { ...currentCategories };
    if (parsed === undefined) delete next[category];
    else next[category] = parsed;
    onSave(next);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-4 py-2 border-b border-line last:border-0">
      <div className="w-32 capitalize">{label}</div>
      <div className="flex-1">
        <div className="flex justify-between text-sm">
          <span>
            <MoneyAmount amount={spent} currency={currency} size="sm" /> spent
          </span>
          {editing ? (
            <Input
              type="number"
              min={0}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-24 h-7"
              data-testid={`budget-input-${category}`}
            />
          ) : (
            <span>
              {typeof budgeted === 'number' ? (
                <>
                  <MoneyAmount amount={budgeted} currency={currency} size="sm" /> budgeted
                </>
              ) : (
                'no budget'
              )}
            </span>
          )}
        </div>
        {byMemberSplit?.share && (
          <div
            className="text-xs text-muted-foreground mt-0.5"
            data-testid={`budget-split-${category}`}
          >
            {byMemberSplit.myNickname}{' '}
            <MoneyAmount amount={byMemberSplit.share.myAmount} currency={currency} size="sm" />
            {' · '}
            {byMemberSplit.partnerNickname}{' '}
            <MoneyAmount amount={byMemberSplit.share.partnerAmount} currency={currency} size="sm" />
          </div>
        )}
        {byMemberSplit && (
          <div
            className={
              byMemberSplit.share
                ? 'text-[0.7rem] text-muted-foreground/70 mt-0.5'
                : 'text-xs text-muted-foreground mt-0.5'
            }
            data-testid={`budget-paid-${category}`}
          >
            {byMemberSplit.share && 'paid: '}
            {byMemberSplit.myNickname}{' '}
            <MoneyAmount amount={byMemberSplit.paid.myAmount} currency={currency} size="sm" />
            {' · '}
            {byMemberSplit.partnerNickname}{' '}
            <MoneyAmount amount={byMemberSplit.paid.partnerAmount} currency={currency} size="sm" />
          </div>
        )}
        <div className="h-2 bg-surface-2 rounded mt-1 overflow-hidden">
          <div
            className={over ? 'h-full bg-neg' : 'h-full bg-accent'}
            style={{ width: `${pct}%` }}
            data-testid={`budget-bar-${category}`}
          />
        </div>
      </div>
      {over && <Badge variant="destructive">Over</Badge>}
      {canEdit && !editing && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(true);
            setDraft(budgeted?.toString() ?? '');
          }}
        >
          Edit
        </Button>
      )}
      {canEdit && editing && (
        <>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={isSaving}>
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}
