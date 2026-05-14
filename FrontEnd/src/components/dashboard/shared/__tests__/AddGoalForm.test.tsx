import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AddGoalForm from '@/components/dashboard/shared/AddGoalForm';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  householdId: mockHousehold._id,
  currency: 'EUR' as const,
};

describe('<AddGoalForm />', () => {
  it('renders name and target amount fields', () => {
    renderWithProviders(<AddGoalForm {...baseProps} />);
    expect(screen.getByText(/name/i)).toBeInTheDocument();
    expect(screen.getByText(/target/i)).toBeInTheDocument();
  });

  it('submits a goal and closes', async () => {
    server.use(
      http.post('/api/households/:id/goals', () =>
        HttpResponse.json({ status: 'success', data: { goal: { _id: 'g1', name: 'Holiday' } } }),
      ),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddGoalForm {...baseProps} onOpenChange={onOpenChange} />);

    // Fill in name field
    const nameInput = screen.getByPlaceholderText(/e\.g\. Summer Vacation/i);
    await user.type(nameInput, 'Holiday');

    // Fill in target amount field
    const amountInput = screen.getByPlaceholderText(/e\.g\. 3000/i);
    await user.type(amountInput, '500');

    // Submit the form
    await user.click(screen.getByRole('button', { name: /add goal/i }));

    // Verify onOpenChange was called with false
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
