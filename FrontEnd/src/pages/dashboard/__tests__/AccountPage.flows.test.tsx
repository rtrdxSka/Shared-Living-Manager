/**
 * AccountPage.flows.test.tsx — 6 integration tests (Task 6 / Batch 7.5)
 *
 * Architecture: renders with the REAL DashboardProvider (not vi.mock) so that
 * openTransactionForm, deleteJointTransaction, and useAddJointTransaction/
 * useDeleteJointTransaction hooks fire real mutations and MSW intercepts axios.
 *
 * DOM notes (from reading AccountPage.tsx + AddTransactionForm.tsx):
 * - Deposit button text: "Deposit"   (calls openTransactionForm('deposit'))
 * - Withdraw button text: "Withdraw" (calls openTransactionForm('withdrawal'))
 * - AddTransactionForm is rendered by DashboardProvider (always mounted), so it
 *   opens as a Sheet when addTransactionOpen = true.
 * - AddTransactionForm submit button:
 *     type === 'deposit'    → "Add Deposit"
 *     type === 'withdrawal' → "Add Withdrawal"
 * - L.3 regression pin: Withdraw → form opens in withdrawal mode → "Add Withdrawal" visible.
 * - Transaction delete: trash-icon (title="Delete transaction") → confirm button "Delete".
 * - Summary response shape: { data: { summary: { balance, monthlyTarget, transactions, … } } }
 *   useJointAccountSummary returns data.data.summary (see joint-account.api.ts).
 * - DashboardProvider GETs on mount:
 *     GET /api/households/:id/joint-account   (joint mode only — mockHouseholdJoint)
 *     GET /api/households/:id/tasks
 *     GET /api/households/:id/goals
 */

import { describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AccountPage from '@/pages/dashboard/AccountPage';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import { mockHouseholdJoint, mockHouseholdRoommatesJoint } from '@/test/mocks/data/households';
import { mockUsers } from '@/test/mocks/data/users';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TX_ALICE_DEPOSIT = {
  _id: 'tx-001',
  householdId: mockHouseholdJoint._id,
  memberId: 'mem-alice-001',
  memberNickname: 'Alice',
  type: 'deposit' as const,
  amount: 500,
  note: 'Monthly contribution',
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

const TX_BOB_WITHDRAWAL = {
  _id: 'tx-002',
  householdId: mockHouseholdJoint._id,
  memberId: 'mem-bob-001',
  memberNickname: 'Bob',
  type: 'withdrawal' as const,
  amount: 200,
  note: 'Shared groceries',
  createdAt: '2026-05-02T10:00:00.000Z',
  updatedAt: '2026-05-02T10:00:00.000Z',
};

const MOCK_SUMMARY_WITH_TXS = {
  balance: 1300,
  monthlyDeposits: 500,
  monthlyWithdrawals: 200,
  monthlyExpenses: 0,
  monthlyNet: 300,
  monthlyTarget: 2000,
  targetMode: 'equal',
  memberBreakdown: [],
  transactions: [TX_ALICE_DEPOSIT, TX_BOB_WITHDRAWAL],
  transactionTotal: 2,
  transactionPage: 1,
  transactionTotalPages: 1,
};

const MOCK_SUMMARY_EMPTY = {
  balance: 0,
  monthlyDeposits: 0,
  monthlyWithdrawals: 0,
  monthlyExpenses: 0,
  monthlyNet: 0,
  monthlyTarget: 1500,
  targetMode: 'equal',
  memberBreakdown: [],
  transactions: [],
  transactionTotal: 0,
  transactionPage: 1,
  transactionTotalPages: 1,
};

// ── Render helper ─────────────────────────────────────────────────────────────

const renderAccountPage = () =>
  renderWithProviders(
    <DashboardProvider household={mockHouseholdJoint} currentUserId={mockUsers.alice._id}>
      <AccountPage />
    </DashboardProvider>,
  );

// ── Default GET handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    // Primary endpoint under test
    http.get('/api/households/:id/joint-account', () =>
      HttpResponse.json({
        status: 'success',
        data: { summary: MOCK_SUMMARY_WITH_TXS },
      }),
    ),
    // DashboardProvider fires these on every mount (joint mode)
    http.get('/api/households/:id/tasks', () =>
      HttpResponse.json({
        status: 'success',
        data: { items: [], nextCursor: null },
      }),
    ),
    http.get('/api/households/:id/goals', () =>
      HttpResponse.json({
        status: 'success',
        data: { items: [], total: 0, page: 1, limit: 20 },
      }),
    ),
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<AccountPage /> flows', () => {
  /**
   * L.1 — Transactions list renders rows from joint-account summary.
   * Both TX_ALICE_DEPOSIT and TX_BOB_WITHDRAWAL should appear.
   */
  it('L.1 — transactions list renders rows from joint-account summary', async () => {
    renderAccountPage();

    // Wait for summary to load — balance appears in the hero card
    await screen.findByText(/joint account/i);

    // Both member nicknames appear in transaction rows
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    // Notes appear alongside nicknames
    expect(screen.getByText(/Monthly contribution/i)).toBeInTheDocument();
    expect(screen.getByText(/Shared groceries/i)).toBeInTheDocument();
  });

  /**
   * L.2 — Click Deposit → AddTransactionForm opens in deposit mode.
   * The form sheet appears with submit button "Add Deposit".
   */
  it('L.2 — Deposit button opens AddTransactionForm in deposit mode', async () => {
    const user = userEvent.setup();
    renderAccountPage();

    // Wait for the page to load
    await screen.findByRole('button', { name: /^deposit$/i });

    await user.click(screen.getByRole('button', { name: /^deposit$/i }));

    // The Sheet opens — submit button confirms deposit mode
    expect(await screen.findByRole('button', { name: /add deposit/i })).toBeInTheDocument();
  });

  /**
   * L.3 — Click Withdraw → AddTransactionForm opens in WITHDRAWAL mode.
   * Regression pin: form must open with "Add Withdrawal" (not "Add Deposit").
   * If openTransactionForm('withdrawal') fails to set defaultType, this fails.
   */
  it('L.3 — Withdraw button opens AddTransactionForm in withdrawal mode (regression pin)', async () => {
    const user = userEvent.setup();
    renderAccountPage();

    // Wait for the Withdraw button to appear
    await screen.findByRole('button', { name: /^withdraw$/i });

    await user.click(screen.getByRole('button', { name: /^withdraw$/i }));

    // The Sheet opens — submit button must say "Add Withdrawal", NOT "Add Deposit"
    expect(await screen.findByRole('button', { name: /add withdrawal/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^add deposit$/i })).not.toBeInTheDocument();
  });

  /**
   * L.4 — Submit deposit → POST → transactions list refetches (GET count increases).
   * useAddJointTransaction.onSuccess calls invalidateQueries → another GET fires.
   */
  it('L.4 — Submit deposit POST fires and triggers list refetch', async () => {
    let getCount = 0;
    let postCalled = false;

    server.use(
      http.get('/api/households/:id/joint-account', () => {
        getCount += 1;
        return HttpResponse.json({
          status: 'success',
          data: { summary: MOCK_SUMMARY_EMPTY },
        });
      }),
      http.post('/api/households/:id/joint-account/transactions', () => {
        postCalled = true;
        return HttpResponse.json({
          status: 'success',
          data: {
            transaction: {
              ...TX_ALICE_DEPOSIT,
              _id: 'tx-new-001',
              amount: 100,
              note: 'Test deposit',
            },
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderAccountPage();

    // Wait for initial load
    await screen.findByRole('button', { name: /^deposit$/i });
    const initialGetCount = getCount;

    // Open the deposit form
    await user.click(screen.getByRole('button', { name: /^deposit$/i }));
    const submitBtn = await screen.findByRole('button', { name: /add deposit/i });

    // Fill in the amount
    const amountInput = screen.getByPlaceholderText(/e\.g\. 500/i);
    await user.type(amountInput, '100');

    // Submit
    await user.click(submitBtn);

    // POST should have fired
    await waitFor(() => expect(postCalled).toBe(true));

    // After success, invalidateQueries triggers a refetch → GET count increases
    await waitFor(() => expect(getCount).toBeGreaterThan(initialGetCount));
  });

  /**
   * L.5 — Monthly target progress visible (balance + monthlyTarget render).
   * The page shows the progress subline when monthlyTarget > 0.
   */
  it('L.5 — Monthly target progress subline is visible', async () => {
    renderAccountPage();

    // Wait for the page heading
    await screen.findByRole('heading', { name: /joint account/i });

    // The subline text appears when hasTarget = true (monthlyTarget > 0)
    // Text: "You've deposited 500 EUR of 2000 EUR monthly target"
    expect(
      await screen.findByText(/deposited.*monthly target/i),
    ).toBeInTheDocument();
  });

  /**
   * L.6 — Delete transaction → DELETE endpoint fires → list refetches.
   * The delete icon button (title="Delete transaction") triggers an inline confirm;
   * clicking the confirm "Delete" button fires DELETE and causes a GET refetch.
   */
  it('L.6 — Delete transaction fires DELETE and refetches list', async () => {
    let deleteCallCount = 0;
    let getCount = 0;

    server.use(
      http.get('/api/households/:id/joint-account', () => {
        getCount += 1;
        return HttpResponse.json({
          status: 'success',
          data: { summary: MOCK_SUMMARY_WITH_TXS },
        });
      }),
      http.delete('/api/households/:id/joint-account/transactions/:tid', () => {
        deleteCallCount += 1;
        return HttpResponse.json({ status: 'success', message: 'Deleted' });
      }),
    );

    const user = userEvent.setup();
    renderAccountPage();

    // Wait for transactions to render
    await screen.findByText('Alice');
    const initialGetCount = getCount;

    // Click the delete icon (title="Delete transaction") on the first row
    const deleteIcon = screen.getAllByTitle('Delete transaction')[0];
    await user.click(deleteIcon);

    // Inline confirm: "Delete" button appears
    const confirmDeleteBtn = await screen.findByRole('button', { name: /^delete$/i });
    await user.click(confirmDeleteBtn);

    // DELETE should have fired
    await waitFor(() => expect(deleteCallCount).toBe(1));

    // onSuccess invalidateQueries → refetch → GET count increases
    await waitFor(() => expect(getCount).toBeGreaterThan(initialGetCount));
  });
});

describe('<AccountPage /> roommates+joint mode', () => {
  beforeEach(() => {
    // Override the default summary handler for these tests with a payload that
    // includes a real targetMode and member breakdown for the 3-member household.
    server.use(
      http.get('/api/households/:id/joint-account', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            summary: {
              balance: 250,
              monthlyDeposits: 250,
              monthlyWithdrawals: 0,
              monthlyExpenses: 0,
              monthlyNet: 250,
              monthlyTarget: 600,
              targetMode: 'equal',
              memberBreakdown: [],
              transactions: [],
              transactionTotal: 0,
              transactionPage: 1,
              transactionTotalPages: 1,
            },
          },
        }),
      ),
    );
  });

  const renderRoommatesAccount = () =>
    renderWithProviders(
      <DashboardProvider
        household={mockHouseholdRoommatesJoint}
        currentUserId={mockUsers.alice._id}
      >
        <AccountPage />
      </DashboardProvider>,
    );

  it('renders the Joint Account heading (does not redirect to /expenses)', async () => {
    renderRoommatesAccount();
    expect(
      await screen.findByRole('heading', { name: /joint account/i }),
    ).toBeInTheDocument();
  });

  it('opens the JointAccountConfigDialog when admin clicks Adjust target', async () => {
    const user = userEvent.setup();
    renderRoommatesAccount();
    await user.click(await screen.findByRole('button', { name: /adjust target/i }));
    // JointAccountConfigDialog uses Radix Dialog — assert the dialog role appears.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
