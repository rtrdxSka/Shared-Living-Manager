import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AddContributionDialog from '@/components/dashboard/shared/AddContributionDialog';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  householdId: mockHousehold._id,
  goalId: 'goal-001',
  goalName: 'Vacation',
  currency: 'EUR' as const,
};

describe('<AddContributionDialog />', () => {
  it('renders amount field', () => {
    renderWithProviders(<AddContributionDialog {...baseProps} />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('submits and closes', async () => {
    server.use(
      http.post(
        '/api/households/:householdId/goals/:goalId/contributions',
        () =>
          HttpResponse.json({
            status: 'success',
            data: {
              goal: {
                _id: 'goal-001',
                name: 'Vacation',
                contributions: [{ _id: 'c1', amount: 50 }],
              },
            },
          }),
      ),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddContributionDialog {...baseProps} onOpenChange={onOpenChange} />);
    await user.type(screen.getByRole('spinbutton'), '50');
    await user.click(screen.getByRole('button', { name: /add contribution/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), { timeout: 2000 });
  });
});
