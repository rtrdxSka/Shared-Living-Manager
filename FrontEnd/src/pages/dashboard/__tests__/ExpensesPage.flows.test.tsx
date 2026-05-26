/**
 * ExpensesPage.flows.test.tsx — Sub-batch I (9 integration tests)
 *
 * Architecture: renders with the REAL DashboardProvider (not vi.mock), so the
 * real useClaimExpense / useRequestResolution / useConfirmResolution /
 * useDisputeResolution mutation hooks fire and MSW intercepts axios calls.
 * This makes the regression pin tests (I.2) meaningful — they will fail if the
 * onError cache-invalidation is removed.
 *
 * DOM notes (from reading ExpensesPage.tsx):
 * - Action buttons appear ONLY in the expanded detail panel.
 *   Each test must click the row to expand it first.
 * - Button text:
 *   "Claim expense"     (canClaim — unpaid expense + myParticipatesInFinances)
 *   "I paid you back"   (canRequestResolution — debtor, i.e. someone else paid)
 *   "Confirm received"  (canConfirmOrDispute, creditor side)
 *   "Dispute"           (canConfirmOrDispute, creditor side)
 *   "Edit expense"      (canEdit — creator, !resolved, !pending)
 *   "Delete expense"    (canDelete — creator, !resolved, !pending)
 *   "Yes, delete"       (confirm-delete inline button)
 * - Outstanding toggle: <button> with only a ChevronDown icon (no text);
 *   identified via the OUTSTANDING eyebrow label's sibling button.
 * - Settled section only renders when settledExpenses.length > 0.
 * - MSW URL: axios baseURL is '/api', so handlers match '/api/households/...'
 *
 * Fixture design:
 *   outstandingExpense      — no paidByUserId (Alice can "Claim expense")
 *   debtorExpense           — paidByUserId = bob  (Alice is debtor → "I paid you back")
 *   pendingAliceCreditor    — paidByUserId = alice, pendingConfirmation = true
 *                             (Alice is creditor → "Confirm received" / "Dispute")
 *   aliceCreatedOutstanding — createdByUserId = alice, no paidByUserId
 *                             (Alice can Edit + Delete)
 *   resolvedExpense         — isResolved = true (populates the Settled section)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import ExpensesPage from '@/pages/dashboard/ExpensesPage';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import { mockHousehold, mockHouseholdJoint } from '@/test/mocks/data/households';
import { mockUsers } from '@/test/mocks/data/users';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Bob entered this expense but no one has claimed it yet. Alice can "Claim expense".
 * Description uses a unique string that won't clash with the 'Groceries' category filter chip.
 */
const outstandingExpense = {
  _id: 'exp-out-001',
  householdId: mockHousehold._id,
  createdByUserId: mockUsers.bob._id,
  description: 'Weekly groceries run',
  amount: 60,
  category: 'groceries',
  date: '2026-05-10',
  isResolved: false,
  debtorStates: [],
  isFullRepayment: false,
  createdAt: '2026-05-10T00:00:00.000Z',
  updatedAt: '2026-05-10T00:00:00.000Z',
};

/**
 * Bob paid, Alice is debtor.
 * canRequestResolution = true for Alice (debtor, !resolved, !pending).
 * Button: "I paid you back".
 */
const debtorExpense = {
  ...outstandingExpense,
  _id: 'exp-debtor-001',
  description: 'Electricity bill',
  category: 'utilities',
  paidByUserId: mockUsers.bob._id,
  paidByNickname: 'Bob',
  debtorStates: [{ userId: mockUsers.alice._id, nickname: 'Alice', share: 30 }],
};

/**
 * Alice paid, Bob requested resolution (pendingConfirmation = true).
 * Alice is creditor; she sees "Confirm received" and "Dispute".
 * Description avoids clashing with the 'Internet' category filter chip.
 */
const pendingAliceCreditor = {
  ...outstandingExpense,
  _id: 'exp-pend-001',
  description: 'Broadband bill',
  category: 'internet',
  paidByUserId: mockUsers.alice._id,
  paidByNickname: 'Alice',
  debtorStates: [
    {
      userId: mockUsers.bob._id,
      nickname: 'Bob',
      share: 30,
      claimedAt: '2026-05-09T08:00:00.000Z',
    },
  ],
};

/**
 * Alice created + is debtor (no payer yet).
 * canEdit = true (creator, !resolved, !pending).
 * canDelete = true (creator, !resolved, !pending).
 * canClaim = true (unpaid).
 */
const aliceCreatedOutstanding = {
  ...outstandingExpense,
  _id: 'exp-alice-001',
  description: 'Netflix subscription',
  category: 'subscriptions',
  createdByUserId: mockUsers.alice._id,
};

/** Settled expense to populate the "SETTLED" section. */
const resolvedExpense = {
  ...outstandingExpense,
  _id: 'exp-resolved-001',
  description: 'Old rent payment',
  category: 'rent',
  paidByUserId: mockUsers.alice._id,
  paidByNickname: 'Alice',
  isResolved: true,
};

// ── Render helper ─────────────────────────────────────────────────────────────

const renderExpensesPage = (household = mockHousehold) =>
  renderWithProviders(
    <DashboardProvider household={household} currentUserId={mockUsers.alice._id}>
      <ExpensesPage />
    </DashboardProvider>,
  );

// ── Default GET handlers (overridden per-test as needed) ──────────────────────

beforeEach(() => {
  server.use(
    http.get('/api/households/:id/expenses', () =>
      HttpResponse.json({
        status: 'success',
        data: {
          items: [
            outstandingExpense,
            debtorExpense,
            pendingAliceCreditor,
            aliceCreatedOutstanding,
          ],
          nextCursor: null,
        },
      }),
    ),
    http.get('/api/households/:id/recurring-expenses', () =>
      HttpResponse.json({ status: 'success', data: { items: [] } }),
    ),
    http.get('/api/households/:id/members/income', () =>
      HttpResponse.json({ status: 'success', data: { items: [] } }),
    ),
    http.get('/api/households/:id/joint-account', () =>
      HttpResponse.json({ status: 'success', data: { summary: null } }),
    ),
    // DashboardProvider also fires these GETs on mount
    http.get('/api/households/:id/tasks', () =>
      HttpResponse.json({ status: 'success', data: { items: [], nextCursor: null } }),
    ),
    http.get('/api/households/:id/goals', () =>
      HttpResponse.json({ status: 'success', data: { items: [], total: 0, page: 1, limit: 20 } }),
    ),
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<ExpensesPage /> flows', () => {
  /**
   * I.1 — Claim outstanding expense fires PATCH /claim.
   * "Claim expense" button only appears for unpaid expenses (no paidByUserId).
   * Must expand the row first.
   */
  it('I.1 — Claim outstanding expense fires PATCH /claim', async () => {
    let claimCalled = false;
    server.use(
      http.post('/api/households/:hid/expenses/:eid/claim', () => {
        claimCalled = true;
        return HttpResponse.json({
          status: 'success',
          data: { expense: { ...outstandingExpense, paidByUserId: mockUsers.alice._id } },
        });
      }),
    );
    const user = userEvent.setup();
    renderExpensesPage();
    // Wait for the outstanding expense to render
    const row = await screen.findByText('Weekly groceries run');
    // Expand the row to reveal action buttons
    await user.click(row);
    // Find "Claim expense" button in the expanded panel
    const claimButton = await screen.findByRole('button', { name: /claim expense/i });
    await user.click(claimButton);
    await waitFor(() => expect(claimCalled).toBe(true));
  });

  /**
   * I.2 — Cache invalidation regression (fbace03).
   * When PATCH /claim returns 400, useClaimExpense.onError must invalidate
   * the expenses query, causing another GET /expenses. We count GET calls.
   * If onError is removed, no second GET fires and this test fails.
   */
  it('I.2 — Cache invalidation on claim failure (regression for fbace03)', async () => {
    let getCallCount = 0;
    server.use(
      http.get('/api/households/:id/expenses', () => {
        getCallCount += 1;
        // Return only the outstanding expense (description is 'Weekly groceries run')
        return HttpResponse.json({
          status: 'success',
          data: { items: [outstandingExpense], nextCursor: null },
        });
      }),
      http.post('/api/households/:hid/expenses/:eid/claim', () =>
        HttpResponse.json(
          { status: 'error', message: 'Expense already claimed' },
          { status: 400 },
        ),
      ),
      // I.2 needs tasks + goals handlers too (DashboardProvider fires them on mount)
      http.get('/api/households/:id/tasks', () =>
        HttpResponse.json({ status: 'success', data: { items: [], tasks: [] } }),
      ),
      http.get('/api/households/:id/goals', () =>
        HttpResponse.json({ status: 'success', data: { items: [], goals: [] } }),
      ),
    );
    const user = userEvent.setup();
    renderExpensesPage();
    // Wait for initial load — use unique description text to avoid filter chip ambiguity
    await screen.findByText('Weekly groceries run');
    // Record GETs so far (initial fetch)
    const initialGets = getCallCount;
    // Expand the row to reveal action buttons
    await user.click(screen.getByText('Weekly groceries run'));
    const claimButton = await screen.findByRole('button', { name: /claim expense/i });
    await user.click(claimButton);
    // The error message surfaces in the inline alert
    expect(await screen.findByText(/already claimed/i)).toBeInTheDocument();
    // onError fires → queryClient.invalidateQueries → another GET
    await waitFor(() => expect(getCallCount).toBeGreaterThan(initialGets));
  });

  /**
   * I.3 — Claim payback on a claimed expense (Alice is debtor).
   * "I paid you back" button — fires POST /claim-payback.
   */
  it('I.3 — Claim payback on debtor expense fires POST /claim-payback', async () => {
    let claimCalled = false;
    server.use(
      http.post('/api/households/:hid/expenses/:eid/claim-payback', () => {
        claimCalled = true;
        return HttpResponse.json({
          status: 'success',
          data: {
            expense: {
              ...debtorExpense,
              debtorStates: [
                { userId: mockUsers.alice._id, nickname: 'Alice', share: 30, claimedAt: '2026-05-10T08:00:00.000Z' },
              ],
            },
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderExpensesPage();
    // Expand the debtorExpense row (unique description — no category chip clash)
    await user.click(await screen.findByText('Electricity bill'));
    const requestButton = await screen.findByRole('button', { name: /i paid you back/i });
    await user.click(requestButton);
    await waitFor(() => expect(claimCalled).toBe(true));
  });

  /**
   * I.4 — Confirm payback: Alice is creditor, expense is pending.
   * "Confirm received" button fires POST /confirm-payback.
   */
  it('I.4 — Confirm payback fires POST /confirm-payback', async () => {
    let confirmCalled = false;
    server.use(
      http.post('/api/households/:hid/expenses/:eid/confirm-payback', () => {
        confirmCalled = true;
        return HttpResponse.json({
          status: 'success',
          data: {
            expense: {
              ...pendingAliceCreditor,
              isResolved: true,
              debtorStates: [
                {
                  userId: mockUsers.bob._id,
                  nickname: 'Bob',
                  share: 30,
                  confirmedAt: '2026-05-10T09:00:00.000Z',
                },
              ],
            },
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderExpensesPage();
    // Expand the pending creditor row (unique description — no category chip clash)
    await user.click(await screen.findByText('Broadband bill'));
    const confirmButton = await screen.findByRole('button', { name: /confirm received/i });
    await user.click(confirmButton);
    await waitFor(() => expect(confirmCalled).toBe(true));
  });

  /**
   * I.5 — Dispute payback: Alice is creditor, expense is pending.
   * "Dispute" button fires POST /dispute-payback.
   */
  it('I.5 — Dispute payback fires POST /dispute-payback', async () => {
    let disputeCalled = false;
    server.use(
      http.post('/api/households/:hid/expenses/:eid/dispute-payback', () => {
        disputeCalled = true;
        return HttpResponse.json({
          status: 'success',
          data: {
            expense: {
              ...pendingAliceCreditor,
              debtorStates: [
                {
                  userId: mockUsers.bob._id,
                  nickname: 'Bob',
                  share: 30,
                  disputedAt: '2026-05-10T09:00:00.000Z',
                },
              ],
            },
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderExpensesPage();
    // Expand the pending creditor row (unique description — no category chip clash)
    await user.click(await screen.findByText('Broadband bill'));
    const disputeButton = await screen.findByRole('button', { name: /^dispute$/i });
    await user.click(disputeButton);
    await waitFor(() => expect(disputeCalled).toBe(true));
  });

  /**
   * I.6 — Joint mode hides "Claim expense" button (regression for ab446cb).
   * In joint mode financeMode === 'joint', so the OUTSTANDING section doesn't
   * render and canClaim logic is also gated by myParticipatesInFinances in split.
   * The OUTSTANDING section is the only place claim buttons appear.
   */
  it('I.6 — Joint mode hides Claim expense button (regression for ab446cb)', async () => {
    renderExpensesPage(mockHouseholdJoint);
    // In joint mode, the OUTSTANDING section is hidden (gated by financeMode === 'split').
    // The settled section is also hidden (no resolved expenses in the fixture).
    // Wait for the page heading to confirm the page mounted successfully.
    await screen.findByRole('heading', { name: /expenses/i });
    // Confirm OUTSTANDING label is absent (joint mode hides it)
    expect(screen.queryByText('OUTSTANDING')).not.toBeInTheDocument();
    // Confirm no "Claim expense" buttons appear anywhere
    expect(screen.queryByRole('button', { name: /claim expense/i })).not.toBeInTheDocument();
  });

  /**
   * I.7 — Edit expense: opens the pre-populated form and submits PATCH /expenses/:eid.
   * canEdit = isCreatorLocal && !isResolved && !pendingConfirmation.
   * aliceCreatedOutstanding: createdByUserId = alice, !resolved, !pending → canEdit = true.
   */
  it('I.7 — Edit expense opens form and submits PATCH', async () => {
    let patchedBody: unknown = null;
    server.use(
      http.patch('/api/households/:hid/expenses/:eid', async ({ request }) => {
        patchedBody = await request.json();
        return HttpResponse.json({
          status: 'success',
          data: {
            expense: { ...aliceCreatedOutstanding, description: 'Netflix — updated' },
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderExpensesPage();
    // Expand alice's row
    await user.click(await screen.findByText('Netflix subscription'));
    const editButton = await screen.findByRole('button', { name: /edit expense/i });
    await user.click(editButton);
    // The edit form opens with 'Netflix subscription' pre-filled
    const descInput = await screen.findByDisplayValue('Netflix subscription');
    await user.clear(descInput);
    await user.type(descInput, 'Netflix subscription — updated');
    // Submit the form
    const saveButton = screen.getByRole('button', { name: /save|update/i });
    await user.click(saveButton);
    await waitFor(() =>
      expect(patchedBody).toEqual(
        expect.objectContaining({ description: 'Netflix subscription — updated' }),
      ),
    );
  });

  /**
   * I.8 — Delete expense via inline confirm.
   * canDelete = isCreatorLocal && !isResolved && !pendingConfirmation.
   * aliceCreatedOutstanding qualifies. The UI shows "Delete expense" → "Yes, delete".
   */
  it('I.8 — Delete expense fires DELETE via inline confirm', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('/api/households/:hid/expenses/:eid', () => {
        deleteCalled = true;
        return HttpResponse.json({ status: 'success', message: 'Deleted' });
      }),
    );
    const user = userEvent.setup();
    renderExpensesPage();
    // Expand alice's row (she created 'Netflix subscription', so canDelete = true)
    await user.click(await screen.findByText('Netflix subscription'));
    const deleteButton = await screen.findByRole('button', { name: /delete expense/i });
    await user.click(deleteButton);
    // Inline confirm dialog appears: "Yes, delete"
    const confirmButton = await screen.findByRole('button', { name: /yes, delete/i });
    await user.click(confirmButton);
    await waitFor(() => expect(deleteCalled).toBe(true));
  });

  /**
   * I.9 — Outstanding/Settled section toggle (regression for 0ce7cda).
   * The OUTSTANDING section header has a chevron <button> that collapses/expands it.
   * The button has no accessible name (just an icon), so we find it via its
   * container and assert aria state or content visibility change.
   * We also exercise the Settled section by including a resolved expense.
   */
  it('I.9 — Outstanding/Settled section toggles collapse state', async () => {
    // Override to include a resolved expense so the SETTLED section renders
    server.use(
      http.get('/api/households/:id/expenses', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            items: [outstandingExpense, resolvedExpense],
            nextCursor: null,
          },
        }),
      ),
      http.get('/api/households/:id/tasks', () =>
        HttpResponse.json({ status: 'success', data: { items: [], tasks: [] } }),
      ),
      http.get('/api/households/:id/goals', () =>
        HttpResponse.json({ status: 'success', data: { items: [], goals: [] } }),
      ),
    );
    const user = userEvent.setup();
    renderExpensesPage();
    // Both sections should be visible initially
    await screen.findByText('OUTSTANDING');
    await screen.findByText('SETTLED');
    // Use unique descriptions — no overlap with category filter chips
    await screen.findByText('Weekly groceries run');
    await screen.findByText('Old rent payment');

    // Find the collapse toggle button in the OUTSTANDING section header.
    // The header structure: div.flex > EyebrowLabel("OUTSTANDING") + ... + button(<ChevronDown>)
    const outstandingLabel = screen.getByText('OUTSTANDING');
    const outstandingHeader = outstandingLabel.closest('div');
    expect(outstandingHeader).not.toBeNull();
    const toggleButton = within(outstandingHeader!).getByRole('button');

    // Click to collapse the outstanding section
    await user.click(toggleButton);

    // After collapsing: the unique description text is no longer visible
    await waitFor(() => {
      expect(screen.queryByText('Weekly groceries run')).not.toBeInTheDocument();
    });

    // Click again to expand
    await user.click(toggleButton);

    // After re-expanding: the description is back
    await screen.findByText('Weekly groceries run');
  });
});
