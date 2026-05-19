import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryBudgetRow from '../CategoryBudgetRow';

describe('CategoryBudgetRow', () => {
  it('shows accent (under-budget) progress bar color when under budget', () => {
    render(
      <CategoryBudgetRow
        category="groceries"
        label="Groceries"
        budgeted={100}
        spent={40}
        canEdit
        isSaving={false}
        onSave={() => {}}
        currentCategories={{ groceries: 100 }}
      />
    );
    const bar = screen.getByTestId('budget-bar-groceries');
    expect(bar.className).toContain('bg-accent');
    expect(bar.className).not.toContain('bg-neg');
  });

  it('shows neg bar + Over badge when spent > budgeted', () => {
    render(
      <CategoryBudgetRow
        category="groceries"
        label="Groceries"
        budgeted={50}
        spent={80}
        canEdit
        isSaving={false}
        onSave={() => {}}
        currentCategories={{ groceries: 50 }}
      />
    );
    const bar = screen.getByTestId('budget-bar-groceries');
    expect(bar.className).toContain('bg-neg');
    expect(screen.getByText('Over')).toBeInTheDocument();
  });

  it('calls onSave with the updated category map when admin saves', () => {
    const onSave = vi.fn();
    render(
      <CategoryBudgetRow
        category="groceries"
        label="Groceries"
        budgeted={100}
        spent={40}
        canEdit
        isSaving={false}
        onSave={onSave}
        currentCategories={{ groceries: 100, rent: 500 }}
      />
    );
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByTestId('budget-input-groceries'), { target: { value: '250' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ groceries: 250, rent: 500 });
  });

  it('does not render the Edit button when canEdit is false', () => {
    render(
      <CategoryBudgetRow
        category="groceries"
        label="Groceries"
        budgeted={100}
        spent={40}
        canEdit={false}
        isSaving={false}
        onSave={() => {}}
        currentCategories={{}}
      />
    );
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('passes undefined to onSave when admin clears the input (removes the category)', () => {
    const onSave = vi.fn();
    render(
      <CategoryBudgetRow
        category="groceries"
        label="Groceries"
        budgeted={100}
        spent={40}
        canEdit
        isSaving={false}
        onSave={onSave}
        currentCategories={{ groceries: 100, rent: 500 }}
      />
    );
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByTestId('budget-input-groceries'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));
    // groceries removed from the next state, rent preserved
    expect(onSave).toHaveBeenCalledWith({ rent: 500 });
  });
});
