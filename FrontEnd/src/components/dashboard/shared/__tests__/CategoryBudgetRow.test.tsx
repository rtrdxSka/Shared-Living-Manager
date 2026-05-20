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

  describe('byMemberSplit prop', () => {
    it('renders neither split nor paid line when byMemberSplit is omitted', () => {
      render(
        <CategoryBudgetRow
          category="groceries"
          label="Groceries"
          budgeted={100}
          spent={60}
          canEdit={false}
          isSaving={false}
          onSave={() => {}}
          currentCategories={{ groceries: 100 }}
        />
      );
      expect(screen.queryByTestId('budget-split-groceries')).not.toBeInTheDocument();
      expect(screen.queryByTestId('budget-paid-groceries')).not.toBeInTheDocument();
    });

    it('renders both share and paid lines in split mode (share defined)', () => {
      render(
        <CategoryBudgetRow
          category="groceries"
          label="Groceries"
          budgeted={1500}
          spent={1000}
          canEdit={false}
          isSaving={false}
          onSave={() => {}}
          currentCategories={{ groceries: 1500 }}
          byMemberSplit={{
            myNickname: 'Alice',
            partnerNickname: 'Bob',
            share: { myAmount: 600, partnerAmount: 400 },
            paid: { myAmount: 1000, partnerAmount: 0 },
          }}
        />
      );

      // Share line — nicknames + share amounts
      const shareLine = screen.getByTestId('budget-split-groceries');
      expect(shareLine).toBeInTheDocument();
      expect(shareLine).toHaveTextContent('Alice');
      expect(shareLine).toHaveTextContent('Bob');
      expect(shareLine).toHaveTextContent('600.00');
      expect(shareLine).toHaveTextContent('400.00');
      // Share line should NOT contain the paid amounts (verifies distinct fields)
      expect(shareLine).not.toHaveTextContent('1000.00');
      expect(shareLine.textContent).toContain('·');

      // Paid line — paid: prefix + nicknames + paid amounts
      const paidLine = screen.getByTestId('budget-paid-groceries');
      expect(paidLine).toBeInTheDocument();
      expect(paidLine.textContent).toMatch(/paid:/i);
      expect(paidLine).toHaveTextContent('Alice');
      expect(paidLine).toHaveTextContent('Bob');
      expect(paidLine).toHaveTextContent('1000.00');
      expect(paidLine).toHaveTextContent('0.00');
      // Paid line should NOT contain the share amounts
      expect(paidLine).not.toHaveTextContent('600.00');
      expect(paidLine).not.toHaveTextContent('400.00');
      expect(paidLine.textContent).toContain('·');
    });

    it('renders only the paid line (without "paid:" prefix) in joint mode (share undefined)', () => {
      render(
        <CategoryBudgetRow
          category="groceries"
          label="Groceries"
          budgeted={1500}
          spent={1000}
          canEdit={false}
          isSaving={false}
          onSave={() => {}}
          currentCategories={{ groceries: 1500 }}
          byMemberSplit={{
            myNickname: 'Alice',
            partnerNickname: 'Bob',
            paid: { myAmount: 750, partnerAmount: 250 },
          }}
        />
      );

      expect(screen.queryByTestId('budget-split-groceries')).not.toBeInTheDocument();

      const paidLine = screen.getByTestId('budget-paid-groceries');
      expect(paidLine).toBeInTheDocument();
      // No "paid:" prefix in joint mode
      expect(paidLine.textContent ?? '').not.toMatch(/paid:/i);
      expect(paidLine).toHaveTextContent('Alice');
      expect(paidLine).toHaveTextContent('Bob');
      expect(paidLine).toHaveTextContent('750.00');
      expect(paidLine).toHaveTextContent('250.00');
      expect(paidLine.textContent).toContain('·');
    });

    it('renders custom split values exactly as provided (no internal split logic)', () => {
      render(
        <CategoryBudgetRow
          category="groceries"
          label="Groceries"
          budgeted={2000}
          spent={1000}
          canEdit={false}
          isSaving={false}
          onSave={() => {}}
          currentCategories={{ groceries: 2000 }}
          byMemberSplit={{
            myNickname: 'Alice',
            partnerNickname: 'Bob',
            share: { myAmount: 700, partnerAmount: 300 },
            paid: { myAmount: 500, partnerAmount: 500 },
          }}
        />
      );

      const shareLine = screen.getByTestId('budget-split-groceries');
      expect(shareLine).toHaveTextContent('700.00');
      expect(shareLine).toHaveTextContent('300.00');

      const paidLine = screen.getByTestId('budget-paid-groceries');
      expect(paidLine).toHaveTextContent('500.00');
      // Both halves render the same number 500.00 once each — verify it appears
      // at least once and that the prefix is present.
      expect(paidLine.textContent).toMatch(/paid:/i);
    });
  });
});
