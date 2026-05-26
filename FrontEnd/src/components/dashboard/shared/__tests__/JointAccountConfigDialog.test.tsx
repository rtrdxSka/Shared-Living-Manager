import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import JointAccountConfigDialog from '@/components/dashboard/shared/JointAccountConfigDialog';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  householdId: mockHousehold._id,
  currency: 'EUR' as const,
};

describe('<JointAccountConfigDialog />', () => {
  it('renders monthly target field and split-mode toggle', () => {
    renderWithProviders(<JointAccountConfigDialog {...baseProps} />);
    // Find amount input
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    // Toggle buttons
    expect(screen.getByRole('button', { name: /equal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /income-based/i })).toBeInTheDocument();
  });

  it('warns when income-based is selected while a member has no income on file', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <JointAccountConfigDialog {...baseProps} membersMissingIncome={['Bob']} />,
    );
    // Default mode is equal — no warning until income-based is picked.
    expect(screen.queryByText(/waiting on income/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /income-based/i }));
    const note = screen.getByText(/waiting on income/i);
    expect(note).toBeInTheDocument();
    expect(note.textContent).toMatch(/Bob/);
  });

  it('shows no income warning when every member has an income', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <JointAccountConfigDialog {...baseProps} membersMissingIncome={[]} />,
    );
    await user.click(screen.getByRole('button', { name: /income-based/i }));
    expect(screen.queryByText(/waiting on income/i)).not.toBeInTheDocument();
  });

  it('submits a target and closes', async () => {
    server.use(
      http.patch('/api/households/:id/joint-account/config', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            household: {
              _id: mockHousehold._id,
              jointAccount: {
                config: { monthlyTarget: 1000, targetMode: 'equal' },
              },
            },
          },
        }),
      ),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<JointAccountConfigDialog {...baseProps} onOpenChange={onOpenChange} />);
    await user.type(screen.getByRole('spinbutton'), '1000');
    await user.click(screen.getByRole('button', { name: /save target/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), { timeout: 2000 });
  });
});
