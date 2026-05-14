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
  mockHouseholdJoint,
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
  pendingConfirmation: false,
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
