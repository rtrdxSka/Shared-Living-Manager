import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AddExpenseForm from '@/components/dashboard/shared/AddExpenseForm';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';
import type { ExpenseResponse } from '@/types/expense.types';

const dashboardMock = { uiMode: 'couple' as 'couple' | 'solo', financeMode: 'split' as 'split' | 'joint' };

vi.mock('@/contexts/useDashboard', () => ({
  useDashboard: () => dashboardMock,
}));

beforeEach(() => {
  dashboardMock.uiMode = 'couple';
  dashboardMock.financeMode = 'split';
});

const mockExpenseResponse: ExpenseResponse = {
  _id: 'expense-001',
  householdId: mockHousehold._id,
  createdByUserId: 'user-alice-001',
  description: 'Coffee',
  amount: 5,
  category: 'other',
  date: '2026-05-14',
  isResolved: false,
  isFullRepayment: false,
  pendingConfirmation: false,
  createdAt: '2026-05-14T00:00:00.000Z',
  updatedAt: '2026-05-14T00:00:00.000Z',
};

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  household: mockHousehold,
};

describe('<AddExpenseForm />', () => {
  it('renders required form fields', () => {
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    // Labels are plain <label> elements with uppercased text
    expect(screen.getByText('DESCRIPTION')).toBeInTheDocument();
    // Amount label includes the currency code
    expect(screen.getByText(`AMOUNT (${mockHousehold.settings.currency})`)).toBeInTheDocument();
    expect(screen.getByText('CATEGORY')).toBeInTheDocument();
  });

  it('disables submit when description is empty', () => {
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    // In create mode the button reads "Add Expense"
    const submit = screen.getByRole('button', { name: /add expense/i });
    expect(submit).toBeDisabled();
  });

  it('joint mode marks Paid By as required (no "(optional)" on PAID BY)', () => {
    // Two labels carry "(optional)" in split mode: PAID BY and NOTES.
    // In joint mode PAID BY drops its hint, so only NOTES remains.
    dashboardMock.financeMode = 'joint';
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    expect(screen.getAllByText(/\(optional\)/i)).toHaveLength(1);
  });

  it('joint mode hides the SPLIT dropdown entirely', () => {
    dashboardMock.financeMode = 'joint';
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    expect(screen.queryByText('SPLIT')).not.toBeInTheDocument();
  });

  it('split mode shows the SPLIT dropdown and keeps Paid By optional', () => {
    dashboardMock.financeMode = 'split';
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    expect(screen.getByText('SPLIT')).toBeInTheDocument();
    // Both PAID BY and NOTES carry "(optional)" in split mode.
    expect(screen.getAllByText(/\(optional\)/i)).toHaveLength(2);
  });

  it('submits a single expense and calls onOpenChange(false)', async () => {
    server.use(
      http.post(`/api/households/${mockHousehold._id}/expenses`, () =>
        HttpResponse.json({ status: 'success', data: mockExpenseResponse }),
      ),
    );

    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <AddExpenseForm {...baseProps} onOpenChange={onOpenChange} />,
    );

    // Description — first textbox in the form
    const descriptionInput = screen.getByPlaceholderText('e.g. Monthly rent');
    await user.type(descriptionInput, 'Coffee');

    // Amount — type="number" renders as spinbutton
    const amountInput = screen.getByPlaceholderText('0.00');
    await user.type(amountInput, '5');

    // Category is pre-selected (EXPENSE_TYPES[0] = 'rent'), so no interaction needed.
    // Paid by is optional. Submit should now be enabled.
    const submitBtn = screen.getByRole('button', { name: /add expense/i });
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
