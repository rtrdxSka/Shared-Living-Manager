import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { fireEvent, screen } from '@testing-library/react';
import AddExpenseForm from '@/components/dashboard/shared/AddExpenseForm';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import type { HouseholdResponse } from '@/types/household.types';
import type { ExpenseResponse } from '@/types/expense.types';

// Controlled mock for the dashboard hook — the only context the form reads.
const dashboardMock = {
  uiMode: 'roommates' as 'couple' | 'solo' | 'roommates',
  financeMode: 'split' as 'split' | 'joint',
  splitMethod: 'equal' as 'equal' | 'income_based' | 'custom',
};

vi.mock('@/contexts/useDashboard', () => ({
  useDashboard: () => dashboardMock,
}));

beforeEach(() => {
  dashboardMock.uiMode = 'roommates';
  dashboardMock.financeMode = 'split';
  dashboardMock.splitMethod = 'equal';
  vi.clearAllMocks();
});

// Build a roommates-mode household with three participating members (Alice, Bob, Carol)
// so the participant selector renders multiple checkboxes.
const roommatesHousehold: HouseholdResponse = {
  ...mockHousehold,
  livingArrangement: 'roommates' as HouseholdResponse['livingArrangement'],
  uiMode: 'roommates' as HouseholdResponse['uiMode'],
  totalMembers: 3,
  members: [
    ...mockHousehold.members,
    {
      _id: 'mem-carol-001',
      userId: 'user-carol-001',
      nickname: 'Carol',
      role: 'member',
      ageGroup: 'adult',
      relationship: 'roommate',
      isCreator: false,
      participatesInFinances: true,
      participatesInTasks: true,
      monthlyIncome: 2500,
      joinedAt: '2026-01-03T00:00:00.000Z',
    } as HouseholdResponse['members'][number],
  ],
};

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  household: roommatesHousehold,
};

describe('<AddExpenseForm /> — participant selector (subgroup)', () => {
  it('hides participant selector for couple uiMode', () => {
    dashboardMock.uiMode = 'couple';
    renderWithProviders(<AddExpenseForm {...baseProps} household={mockHousehold} />);
    expect(screen.queryByText(/who shares this/i)).toBeNull();
  });

  it('hides participant selector for solo uiMode', () => {
    dashboardMock.uiMode = 'solo';
    renderWithProviders(<AddExpenseForm {...baseProps} household={mockHousehold} />);
    expect(screen.queryByText(/who shares this/i)).toBeNull();
  });

  it('shows participant selector for roommates uiMode with all members checked by default', () => {
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    expect(screen.getByText(/who shares this/i)).toBeInTheDocument();

    const aliceCb = screen.getByLabelText('Alice') as HTMLInputElement;
    const bobCb = screen.getByLabelText('Bob') as HTMLInputElement;
    const carolCb = screen.getByLabelText('Carol') as HTMLInputElement;
    expect(aliceCb.checked).toBe(true);
    expect(bobCb.checked).toBe(true);
    expect(carolCb.checked).toBe(true);
  });

  it('clears paidByUserId when the current payer is unchecked from participants', async () => {
    // Drive the form through edit mode so the paidByUserId is preset to Alice.
    // This avoids opening the Radix Select trigger, which crashes under jsdom
    // (hasPointerCapture not implemented). The behavior under test is the
    // state coupling between the participant checkboxes and the paid-by state,
    // which is independent of how the paid-by got its initial value.
    const expense: ExpenseResponse = {
      _id: 'expense-sub-001',
      householdId: roommatesHousehold._id,
      paidByUserId: 'user-alice-001',
      createdByUserId: 'user-alice-001',
      description: 'Pizza',
      amount: 30,
      category: 'other',
      date: '2026-05-14',
      isResolved: false,
      isFullRepayment: false,
      debtorStates: [],
      createdAt: '2026-05-14T00:00:00.000Z',
      updatedAt: '2026-05-14T00:00:00.000Z',
    };
    const user = userEvent.setup();
    renderWithProviders(<AddExpenseForm {...baseProps} expense={expense} />);

    // The PAID BY select shows "Alice" as the displayed value before we
    // uncheck her. We assert by reading the select trigger's text content.
    const paidByGroup = screen.getByText('PAID BY').closest('div.flex.flex-col');
    expect(paidByGroup?.textContent).toMatch(/Alice/);

    // Uncheck Alice in the participant grid.
    const aliceCb = screen.getByLabelText('Alice') as HTMLInputElement;
    expect(aliceCb.checked).toBe(true);
    await user.click(aliceCb);
    expect(aliceCb.checked).toBe(false);

    // The paid-by value should now be cleared — the Radix Select falls back to
    // showing the "__none__" option label ("Not paid yet") because that's the
    // current bound value.
    expect(paidByGroup?.textContent).toMatch(/not paid yet/i);
    expect(paidByGroup?.textContent).not.toMatch(/^Alice$/);
  });

  it('shows joint-mode informational note when roommates + joint', () => {
    dashboardMock.financeMode = 'joint';
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    expect(screen.getByText(/joint account still pays/i)).toBeInTheDocument();
  });
});

describe('AddExpenseForm — custom split overrides', () => {
  it('hides custom % inputs when splitMethod !== custom', () => {
    dashboardMock.uiMode = 'roommates';
    dashboardMock.splitMethod = 'equal';
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    expect(screen.queryByLabelText(/Alice %/i)).toBeNull();
  });

  it('shows per-participant percentage inputs when splitMethod=custom and uiMode=roommates', () => {
    dashboardMock.uiMode = 'roommates';
    dashboardMock.splitMethod = 'custom';
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    expect(screen.getByLabelText(/Alice %/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bob %/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Carol %/i)).toBeInTheDocument();
  });

  it('does NOT show custom % inputs for couple+custom (uiMode gate dominant)', () => {
    dashboardMock.uiMode = 'couple';
    dashboardMock.splitMethod = 'custom';
    renderWithProviders(<AddExpenseForm {...baseProps} household={mockHousehold} />);
    expect(screen.queryByLabelText(/ %$/i)).toBeNull();
  });

  it('disables submit when percentages do not sum to 100', () => {
    dashboardMock.uiMode = 'roommates';
    dashboardMock.splitMethod = 'custom';
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    // Fill required fields so the only thing keeping submit disabled is the pct sum.
    fireEvent.change(screen.getByPlaceholderText(/Monthly rent/i), { target: { value: 'Pizza' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '30' } });

    fireEvent.change(screen.getByLabelText(/Alice %/i), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(/Bob %/i),   { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Carol %/i), { target: { value: '20' } });
    const submitBtn = screen.getByRole('button', { name: /add expense/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit when percentages sum to 100', () => {
    dashboardMock.uiMode = 'roommates';
    dashboardMock.splitMethod = 'custom';
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText(/Monthly rent/i), { target: { value: 'Pizza' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '30' } });

    fireEvent.change(screen.getByLabelText(/Alice %/i), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText(/Bob %/i),   { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Carol %/i), { target: { value: '20' } });
    const submitBtn = screen.getByRole('button', { name: /add expense/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('re-initializes percentages when participants change', () => {
    dashboardMock.uiMode = 'roommates';
    dashboardMock.splitMethod = 'custom';
    renderWithProviders(<AddExpenseForm {...baseProps} />);
    // Initially 3 participants → each gets ~33%. Uncheck Carol → 2 participants → ~50/50.
    fireEvent.click(screen.getByLabelText('Carol'));
    // Alice and Bob should now have % inputs; Carol's should be gone.
    expect(screen.getByLabelText(/Alice %/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bob %/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Carol %/i)).toBeNull();
  });
});
