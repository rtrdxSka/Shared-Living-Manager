import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AddTransactionForm from '@/components/dashboard/shared/AddTransactionForm';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  householdId: mockHousehold._id,
  currency: 'EUR' as const,
};

describe('<AddTransactionForm />', () => {
  it('renders amount and type controls (defaults to deposit)', () => {
    renderWithProviders(<AddTransactionForm {...baseProps} />);
    // Amount input is type=number → role=spinbutton
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    // Toggle buttons are plain <button type="button"> with exact text "Deposit" / "Withdrawal".
    // The submit button reads "Add Deposit" so we must use exact match to avoid collision.
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdrawal' })).toBeInTheDocument();
  });

  it('submits a deposit and closes', async () => {
    server.use(
      http.post(
        `/api/households/${mockHousehold._id}/joint-account/transactions`,
        () =>
          HttpResponse.json({
            status: 'success',
            data: { transaction: { _id: 'tx-001' } },
          }),
      ),
    );

    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <AddTransactionForm {...baseProps} onOpenChange={onOpenChange} />,
    );

    await user.type(screen.getByRole('spinbutton'), '100');

    // Submit button text is "Add Deposit" (type=submit) — distinct from the "Deposit" toggle button
    const submitBtn = screen.getByRole('button', { name: /add deposit/i });
    expect(submitBtn).not.toBeDisabled();
    await user.click(submitBtn);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), {
      timeout: 2000,
    });
  });

  it('opens in withdrawal mode when defaultType="withdrawal"', () => {
    renderWithProviders(
      <AddTransactionForm {...baseProps} defaultType="withdrawal" />,
    );

    // The component uses plain <button> elements with conditional className.
    // When withdrawal is active the button gets:  border-warn/60 bg-warn-bg text-warn
    // When it is inactive it gets:               border-line bg-surface-2 text-ink-3
    // Neither `aria-pressed` nor `data-state` is used — we inspect the className directly.
    // Use exact names to avoid matching "Add Withdrawal" and "Add Deposit" submit buttons.
    const withdrawalBtn = screen.getByRole('button', { name: 'Withdrawal' });
    const depositBtn = screen.getByRole('button', { name: 'Deposit' });

    // Withdrawal should be in its "active" variant (contains warn classes)
    expect(withdrawalBtn.className).toMatch(/bg-warn-bg/);
    // Deposit should be in its "inactive" variant (contains surface-2 class)
    expect(depositBtn.className).toMatch(/bg-surface-2/);

    // Submit button should also reflect the selected mode
    expect(screen.getByRole('button', { name: /add withdrawal/i })).toBeInTheDocument();
  });
});
