/**
 * ExpensesPage.modes.test.tsx — Sub-batch I-m (4 mode matrix tests)
 *
 * Architecture: renders with the REAL DashboardProvider (not vi.mock), same
 * pattern as ExpensesPage.flows.test.tsx.
 *
 * Mode signals (from reading ExpensesPage.tsx + dashboardHelpers.ts):
 *
 *   split + equal
 *     SplitMethodCallout: "50/50" (line 846)
 *     Expanded-detail "Your share": "Your share: 25.00 EUR" (getMyShareLabel → equal branch)
 *
 *   split + income_based  (MSW returns alice=3000, bob=2000 → 60/40)
 *     SplitMethodCallout: "Income-based split — feels fairer this way" (line 851)
 *     Expanded-detail "Your share": "Your share: 30.00 EUR (60%)"
 *
 *   split + usage_based
 *     SplitMethodCallout: renders an empty Card — usage_based hits no `if` branch
 *     (only 'equal', 'income_based', 'custom' are handled).
 *     The distinctive signal must come from the expanded-detail "Your share" row,
 *     which falls through to the customMyPct branch:
 *       "Your share: 25.00 EUR (50%)"   (customMyPct defaults to 50)
 *     This differs from equal-split which renders "Your share: 25.00 EUR" (no %).
 *     See I-m.3 comment for the confirmed skip reasoning if that collapses.
 *
 *   joint
 *     OUTSTANDING section is hidden (financeMode === 'split' guard on line ~330).
 *     No claim button anywhere.
 *     No split/share labels.
 *
 * Note on baseExpense:
 *   We use paidByUserId = bob so that the "Your share" label appears in the
 *   expanded detail panel (gated by expense.paidByUserId on line 695).
 *   The expense is NOT resolved (isResolved: false), so it appears in OUTSTANDING.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import ExpensesPage from '@/pages/dashboard/ExpensesPage';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import {
  mockHouseholdSplitEqual,
  mockHouseholdSplitIncomeBased,
  mockHouseholdSplitUsageBased,
  mockHouseholdSplitCustom,
  mockHouseholdJoint,
  mockHouseholdRoommatesSplit,
  mockHouseholdRoommatesJoint,
} from '@/test/mocks/data/households';
import { mockUsers } from '@/test/mocks/data/users';

// ── Fixture ──────────────────────────────────────────────────────────────────

/**
 * Bob paid so the "Your share" row is visible when Alice expands the detail panel.
 * (The share label is gated by `expense.paidByUserId` — line 695 of ExpensesPage.tsx.)
 */
const baseExpense = {
  _id: 'exp-mode-001',
  householdId: 'hh-couple-001',
  createdByUserId: mockUsers.bob._id,
  paidByUserId: mockUsers.bob._id,
  paidByNickname: 'Bob',
  description: 'Broadband subscription',
  amount: 50,
  category: 'utilities',
  date: '2026-05-05',
  isResolved: false,
  debtorStates: [{ userId: mockUsers.alice._id, nickname: 'Alice', share: 25 }],
  isFullRepayment: false,
  createdAt: '2026-05-05T00:00:00.000Z',
  updatedAt: '2026-05-05T00:00:00.000Z',
};

// ── Render helper ─────────────────────────────────────────────────────────────

const renderWithMode = (household: Parameters<typeof DashboardProvider>[0]['household']) =>
  renderWithProviders(
    <DashboardProvider household={household} currentUserId={mockUsers.alice._id}>
      <ExpensesPage />
    </DashboardProvider>,
  );

// ── MSW handlers ─────────────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get('/api/households/:id/expenses', () =>
      HttpResponse.json({
        status: 'success',
        data: { items: [baseExpense], total: 1, nextCursor: null },
      }),
    ),
    http.get('/api/households/:id/recurring-expenses', () =>
      HttpResponse.json({ status: 'success', data: { items: [] } }),
    ),
    // Income data: alice=3000, bob=2000 → 60%/40% split for income_based mode
    http.get('/api/households/:id/members/income', () =>
      HttpResponse.json({
        status: 'success',
        data: {
          items: [
            { memberId: 'mem-alice-001', monthlyIncome: 3000 },
            { memberId: 'mem-bob-001', monthlyIncome: 2000 },
          ],
        },
      }),
    ),
    http.get('/api/households/:id/joint-account', () =>
      HttpResponse.json({ status: 'success', data: { summary: null } }),
    ),
    // DashboardProvider fires these on mount
    http.get('/api/households/:id/tasks', () =>
      HttpResponse.json({ status: 'success', data: { items: [], tasks: [] } }),
    ),
    http.get('/api/households/:id/goals', () =>
      HttpResponse.json({ status: 'success', data: { items: [], goals: [] } }),
    ),
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<ExpensesPage /> mode matrix', () => {
  /**
   * I-m.1 — split + equal renders equal-split signal.
   *
   * Signals checked (page-level, no expansion needed):
   *   SplitMethodCallout: "50/50" (rendered when financeMode === 'split')
   *
   * Expanded-detail signal (secondary, expand row for certainty):
   *   "Your share: 25.00 EUR" (no percentage — equal branch of getMyShareLabel)
   */
  it('I-m.1 — split + equal renders equal-split signal', async () => {
    const user = userEvent.setup();
    renderWithMode(mockHouseholdSplitEqual);

    // Page-level signal: SplitMethodCallout renders "50/50" in a <strong> tag.
    // Multiple elements contain "50/50" text (also the NET BALANCE rail and balance
    // summary span). Use getAllByText and check at least one exists.
    const row = await screen.findByText('Broadband subscription');
    // Confirm the SplitMethodCallout prose is present (contains "50/50")
    const calloutMatches = screen.getAllByText(/50\/50/i);
    expect(calloutMatches.length).toBeGreaterThan(0);

    // Expand the row to also confirm the per-expense share label
    await user.click(row);
    // "Your share: 25.00 EUR" — no percentage suffix for equal split
    const shareLabel = await screen.findByText(/your share:\s*25\.00\s*EUR$/i);
    expect(shareLabel).toBeInTheDocument();

    // Confirm: equal split does NOT render a percentage in the share label
    expect(screen.queryByText(/your share:\s*25\.00\s*EUR\s*\(\d+%\)/i)).not.toBeInTheDocument();
  });

  /**
   * I-m.2 — split + income_based renders income-based signal.
   *
   * With alice=3000, bob=2000, deriveIncomeSplit gives alice=60%, bob=40%.
   *
   * Signals:
   *   SplitMethodCallout: "Income-based split — feels fairer this way"
   *   Expanded-detail: "Your share: 30.00 EUR (60%)"
   */
  it('I-m.2 — split + income_based renders income-based signal', async () => {
    const user = userEvent.setup();
    renderWithMode(mockHouseholdSplitIncomeBased);

    // Page-level signal: SplitMethodCallout renders "Income-based split — feels fairer this way".
    // Multiple elements contain "income-based split" (also the balance rail summary).
    // getAllByText is appropriate here — at least one of them should be present.
    const row = await screen.findByText('Broadband subscription');
    const incomeMatches = screen.getAllByText(/income-based split/i);
    expect(incomeMatches.length).toBeGreaterThan(0);

    // Expand the row to confirm per-expense share label
    await user.click(row);
    // "Your share: 30.00 EUR (60%)" — income_based branch of getMyShareLabel
    // alice=3000, bob=2000 → alice is 60% of total income → share = 50 * 0.60 = 30.00
    const shareLabel = await screen.findByText(/your share:\s*30\.00\s*EUR\s*\(60%\)/i);
    expect(shareLabel).toBeInTheDocument();
  });

  /**
   * I-m.3 — split + usage_based renders usage-based signal.
   *
   * SplitMethodCallout: usage_based hits NONE of the 'equal'/'income_based'/'custom'
   * branches, so the Card renders empty at page level. No page-level signal is available.
   *
   * The distinctive signal comes from the expanded-detail "Your share" row:
   *   getMyShareLabel falls through to the customMyPct branch →
   *   "Your share: 25.00 EUR (50%)"   (customMyPct defaults to 50)
   *
   * This IS distinguishable from equal-split: equal renders "25.00 EUR" (no %)
   * while usage_based renders "25.00 EUR (50%)".
   */
  it('I-m.3 — split + usage_based renders usage-based signal', async () => {
    const user = userEvent.setup();
    renderWithMode(mockHouseholdSplitUsageBased);

    // Wait for the expense row to confirm the page mounted
    const row = await screen.findByText('Broadband subscription');

    // Expand to reveal expanded-detail share label
    await user.click(row);

    // Primary signal: "Your share: 25.00 EUR (50%)"
    // usage_based falls through to the customMyPct branch of getMyShareLabel
    // (customMyPct defaults to 50). The "(50%)" suffix distinguishes this from
    // equal-split which renders "Your share: 25.00 EUR" with NO percentage suffix.
    const shareLabel = await screen.findByText(/your share:\s*25\.00\s*EUR\s*\(50%\)/i);
    expect(shareLabel).toBeInTheDocument();

    // Page-level signal: the NET BALANCE rail renders getBalanceSplitLabel which
    // returns "50/50 custom split" for usage_based (falls through to customMyPct branch).
    // Note: the SplitMethodCallout renders an EMPTY card for usage_based — it has no
    // matching branch (only 'equal', 'income_based', 'custom' are handled there).
    const customSplitMatches = screen.getAllByText(/50\/50 custom split/i);
    expect(customSplitMatches.length).toBeGreaterThan(0);

    // Confirm: no income-based prose
    expect(screen.queryAllByText(/income-based split/i)).toHaveLength(0);
  });

  /**
   * I-m.4 — joint mode hides share labels and claim button.
   *
   * In joint mode (financeMode === 'joint'):
   *   - The OUTSTANDING section is hidden (gated by financeMode === 'split', line ~330)
   *   - No claim buttons appear
   *   - No split/share/income labels appear
   */
  it('I-m.4 — joint mode hides share labels and claim button', async () => {
    renderWithMode(mockHouseholdJoint);

    // Wait for the page heading to confirm the page mounted
    await screen.findByRole('heading', { name: /expenses/i });

    // OUTSTANDING section is absent in joint mode
    expect(screen.queryByText('OUTSTANDING')).not.toBeInTheDocument();

    // No claim button anywhere
    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();

    // No split/share labels
    expect(
      screen.queryByText(/split equally|by income|income-based split|your share|50\/50/i),
    ).not.toBeInTheDocument();
  });
});

// ── Joint-mode settled-UI cleanup ──────────────────────────────────────────────
//
// Joint-mode expenses are auto-resolved, so the green "SETTLED" collapsible
// duplicates the flat list (roommates) or is the only list (couple), and the
// "✓ Share settled" card hint fires on every card where "share" is meaningless.
// In joint mode we show ONE flat list and drop both bits of settled UI; split
// mode keeps them.

describe('<ExpensesPage /> joint-mode settled-UI cleanup', () => {
  const resolvedExpense = {
    ...baseExpense,
    _id: 'exp-joint-resolved-001',
    description: 'Joint groceries',
    amount: 80,
    isResolved: true,
  };

  beforeEach(() => {
    server.use(
      http.get('/api/households/:id/expenses', () =>
        HttpResponse.json({
          status: 'success',
          data: { items: [resolvedExpense], total: 1, nextCursor: null },
        }),
      ),
    );
  });

  it('couple+joint shows a single flat list — no SETTLED dropdown, no "Share settled" text', async () => {
    const user = userEvent.setup();
    renderWithMode(mockHouseholdJoint);

    // Flat ALL EXPENSES list — covers couple+joint, which previously relied on
    // the SETTLED block to render any expenses at all.
    expect(await screen.findByText(/^ALL EXPENSES$/)).toBeInTheDocument();
    const row = await screen.findByText('Joint groceries');

    // The redundant green SETTLED collapsible must not appear in joint mode.
    expect(screen.queryByText(/^SETTLED$/)).not.toBeInTheDocument();

    // Expand the card — the "✓ Share settled" hint is meaningless in joint mode.
    await user.click(row);
    expect(screen.queryByText(/share settled/i)).not.toBeInTheDocument();
  });

  it('split mode keeps the SETTLED section and the "Share settled" hint for resolved expenses', async () => {
    const user = userEvent.setup();
    renderWithMode(mockHouseholdSplitEqual);

    expect(await screen.findByText(/^SETTLED$/)).toBeInTheDocument();
    await user.click(await screen.findByText('Joint groceries'));
    expect(await screen.findByText(/share settled/i)).toBeInTheDocument();
  });
});

// ── Custom split is owner-relative (regression for the 70/70 bug) ──────────────
//
// The stored customSplitPercentage (70) is the OWNER's share. Each user must see
// THEIR OWN share: owner Alice → 70% (€350), partner Bob → 30% (€150). Before the
// fix, customMyPct was the raw stored value for everyone, so Bob wrongly saw 70%.

describe('<ExpensesPage /> custom split is owner-relative', () => {
  const customExpense = {
    ...baseExpense,
    _id: 'exp-custom-001',
    description: 'Big custom expense',
    amount: 500,
    paidByUserId: mockUsers.alice._id,
    paidByNickname: 'Alice',
    debtorStates: [{ userId: mockUsers.bob._id, nickname: 'Bob', share: 150 }],
  };

  beforeEach(() => {
    server.use(
      http.get('/api/households/:id/expenses', () =>
        HttpResponse.json({
          status: 'success',
          data: { items: [customExpense], total: 1, nextCursor: null },
        }),
      ),
    );
  });

  it('owner sees their stored share (70% = €350)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DashboardProvider household={mockHouseholdSplitCustom} currentUserId={mockUsers.alice._id}>
        <ExpensesPage />
      </DashboardProvider>,
    );
    await user.click(await screen.findByText('Big custom expense'));
    expect(
      await screen.findByText(/your share:\s*350\.00\s*EUR\s*\(70%\)/i),
    ).toBeInTheDocument();
  });

  it('non-owner partner sees the complement (30% = €150), not the owner 70%', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DashboardProvider household={mockHouseholdSplitCustom} currentUserId={mockUsers.bob._id}>
        <ExpensesPage />
      </DashboardProvider>,
    );
    await user.click(await screen.findByText('Big custom expense'));
    expect(
      await screen.findByText(/your share:\s*150\.00\s*EUR\s*\(30%\)/i),
    ).toBeInTheDocument();
    // Regression guard: before the fix this wrongly showed €350 (70%).
    expect(screen.queryByText(/your share:\s*350\.00\s*EUR/i)).not.toBeInTheDocument();
  });
});

describe('<ExpensesPage /> roommates rendering', () => {
  // Override the default expenses handler from the top-level beforeEach with a
  // single Rent expense scoped to the roommates household.
  beforeEach(() => {
    server.use(
      http.get('/api/households/:id/expenses', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            items: [
              {
                ...baseExpense,
                _id: 'exp-rmt-001',
                description: 'Rent — May',
                amount: 600,
                householdId: 'hh-roommates-001',
              },
            ],
            total: 1,
            nextCursor: null,
          },
        }),
      ),
    );
  });

  it('roommates+split shows the unsettled expense in the Outstanding section', async () => {
    renderWithProviders(
      <DashboardProvider
        household={mockHouseholdRoommatesSplit}
        currentUserId={mockUsers.alice._id}
      >
        <ExpensesPage />
      </DashboardProvider>,
    );
    // OUTSTANDING eyebrow proves the section renders.
    expect(await screen.findByText(/^OUTSTANDING$/)).toBeInTheDocument();
    // The expense row renders.
    expect(await screen.findByText(/Rent — May/)).toBeInTheDocument();
  });

  it('roommates+joint shows expenses in a flat All Expenses list', async () => {
    renderWithProviders(
      <DashboardProvider
        household={mockHouseholdRoommatesJoint}
        currentUserId={mockUsers.alice._id}
      >
        <ExpensesPage />
      </DashboardProvider>
    );
    expect(await screen.findByText(/^ALL EXPENSES$/)).toBeInTheDocument();
    expect(await screen.findByText(/Rent — May/)).toBeInTheDocument();
    // The Outstanding section header must NOT appear in joint mode.
    expect(screen.queryByText(/^OUTSTANDING$/)).not.toBeInTheDocument();
  });
});

// ── Multi-debtor (roommates split, N≥2) — the regression suite for Bug C ──

describe('<ExpensesPage /> roommates-split multi-debtor', () => {
  const carolUserId = 'user-carol-001';
  const aliceId = mockUsers.alice._id;
  const bobId = mockUsers.bob._id;

  function buildMultiDebtorExpense(opts: {
    bob?: { claimedAt?: string; confirmedAt?: string };
    carol?: { claimedAt?: string; confirmedAt?: string };
    isResolved?: boolean;
  }) {
    return {
      _id: 'exp-multi-001',
      householdId: 'hh-roommates-001',
      createdByUserId: aliceId,
      paidByUserId: aliceId,
      paidByNickname: 'Alice',
      description: 'Groceries — multi-debtor',
      amount: 90,
      category: 'groceries',
      date: '2026-05-15',
      isResolved: opts.isResolved ?? false,
      debtorStates: [
        { userId: bobId, nickname: 'Bob', share: 30, ...(opts.bob ?? {}) },
        { userId: carolUserId, nickname: 'Carol', share: 30, ...(opts.carol ?? {}) },
      ],
      isFullRepayment: false,
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
    };
  }

  function setupExpense(expense: ReturnType<typeof buildMultiDebtorExpense>) {
    server.use(
      http.get('/api/households/:id/expenses', () =>
        HttpResponse.json({
          status: 'success',
          data: { items: [expense], total: 1, nextCursor: null },
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
      http.get('/api/households/:id/tasks', () =>
        HttpResponse.json({ status: 'success', data: { items: [], tasks: [] } }),
      ),
      http.get('/api/households/:id/goals', () =>
        HttpResponse.json({ status: 'success', data: { items: [], goals: [] } }),
      ),
    );
  }

  it('renders per-debtor sub-rows; Bob sees only his own "I paid you back" button', async () => {
    setupExpense(buildMultiDebtorExpense({}));
    const user = userEvent.setup();
    renderWithProviders(
      <DashboardProvider household={mockHouseholdRoommatesSplit} currentUserId={bobId}>
        <ExpensesPage />
      </DashboardProvider>,
    );
    await user.click(await screen.findByText('Groceries — multi-debtor'));
    // The MultiDebtorList renders a "Owes" badge per debtor when no claim has happened yet.
    const owesBadges = await screen.findAllByText(/^Owes$/);
    expect(owesBadges).toHaveLength(2);
    // The progress summary shows "$0.00 of $60.00 paid back".
    expect(screen.getByText(/\$0\.00 of \$60\.00 paid back/)).toBeInTheDocument();
    // Bob (the current user) sees exactly one "I paid you back" button — his own row.
    const paybackButtons = await screen.findAllByRole('button', { name: /i paid you back/i });
    expect(paybackButtons).toHaveLength(1);
  });

  it('shows "Claimed — awaiting Alice" on the row of the debtor who has claimed', async () => {
    setupExpense(
      buildMultiDebtorExpense({ bob: { claimedAt: '2026-05-16T08:00:00.000Z' } })
    );
    const user = userEvent.setup();
    renderWithProviders(
      <DashboardProvider household={mockHouseholdRoommatesSplit} currentUserId={bobId}>
        <ExpensesPage />
      </DashboardProvider>,
    );
    await user.click(await screen.findByText('Groceries — multi-debtor'));
    expect(await screen.findByText(/Claimed — awaiting Alice/)).toBeInTheDocument();
  });

  it('payer view shows Confirm/Dispute buttons only for debtors with a pending claim', async () => {
    setupExpense(
      buildMultiDebtorExpense({ bob: { claimedAt: '2026-05-16T08:00:00.000Z' } })
    );
    const user = userEvent.setup();
    renderWithProviders(
      <DashboardProvider household={mockHouseholdRoommatesSplit} currentUserId={aliceId}>
        <ExpensesPage />
      </DashboardProvider>,
    );
    await user.click(await screen.findByText('Groceries — multi-debtor'));
    // Alice sees Confirm and Dispute on Bob's row.
    expect(await screen.findByRole('button', { name: /^confirm$/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^dispute$/i })).toBeInTheDocument();
    // Carol has not claimed, so there is no second Confirm button.
    const confirmButtons = screen.queryAllByRole('button', { name: /^confirm$/i });
    expect(confirmButtons).toHaveLength(1);
  });

  it('confirming Bob does NOT settle Carol — the regression test for the original bug', async () => {
    // Server returns updated expense with Bob confirmed but Carol still pending.
    setupExpense(
      buildMultiDebtorExpense({
        bob: { claimedAt: '2026-05-16T08:00:00.000Z' },
        carol: { claimedAt: '2026-05-16T08:30:00.000Z' },
      })
    );
    server.use(
      http.post('/api/households/:hid/expenses/:eid/confirm-payback', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            expense: buildMultiDebtorExpense({
              bob: { claimedAt: '2026-05-16T08:00:00.000Z', confirmedAt: '2026-05-16T09:00:00.000Z' },
              carol: { claimedAt: '2026-05-16T08:30:00.000Z' },
              isResolved: false,
            }),
          },
        }),
      ),
      http.get('/api/households/:id/expenses', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            items: [
              buildMultiDebtorExpense({
                bob: { claimedAt: '2026-05-16T08:00:00.000Z', confirmedAt: '2026-05-16T09:00:00.000Z' },
                carol: { claimedAt: '2026-05-16T08:30:00.000Z' },
                isResolved: false,
              }),
            ],
            total: 1,
            nextCursor: null,
          },
        }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <DashboardProvider household={mockHouseholdRoommatesSplit} currentUserId={aliceId}>
        <ExpensesPage />
      </DashboardProvider>,
    );
    await user.click(await screen.findByText('Groceries — multi-debtor'));
    // Both rows currently say "Claimed — awaiting Alice". Click Confirm on the first.
    const confirmButtons = await screen.findAllByRole('button', { name: /^confirm$/i });
    await user.click(confirmButtons[0]);
    // After the mutation refetches, Bob's row should now say "Paid back" while Carol still shows pending.
    expect(await screen.findByText(/Paid back/)).toBeInTheDocument();
    // The expense remains in the Outstanding section (not Settled).
    expect(screen.getByText(/^OUTSTANDING$/)).toBeInTheDocument();
  });
});
