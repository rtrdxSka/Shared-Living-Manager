/**
 * Central registry of every `data-testid` the e2e suite relies on.
 *
 * Policy:
 *   - Prefer Playwright's role/text/label/placeholder selectors over testids.
 *   - Add a testid ONLY when the target has no accessible role and no unique
 *     text to anchor against (e.g. an invite-code string, a tab indicator).
 *   - When a testid is added to a frontend source file, declare it here so all
 *     specs share a single constant. Tests using a string testid not present
 *     in this map are a refactor smell.
 *
 * This file is intentionally small at first; entries are appended as the
 * tests in Tasks 11-40 surface a genuine need. Each entry must correspond to
 * a real `data-testid="..."` attribute somewhere under `FrontEnd/src/`.
 */
export const TID = {
  // Populated incrementally as later batches introduce testids. The two
  // entries below are the known prospective testids called out in the plan.
  inviteCode: 'invite-code',
  /**
   * AddTransactionForm tab buttons. Each carries a stable testid and a Radix-
   * style `data-state="active"|"inactive"` attribute. Group B (B04) uses
   * `data-state` to confirm the withdraw-default-tab fix.
   */
  transactionFormTabDeposit: 'transaction-form-tab-deposit',
  transactionFormTabWithdrawal: 'transaction-form-tab-withdrawal',
  /** Legacy alias preserved for prior consumers. */
  withdrawDefaultTab: 'transaction-form-tab-withdrawal',
} as const;

export type TestId = (typeof TID)[keyof typeof TID];
