import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AddRecurringItemForm from '@/components/dashboard/shared/AddRecurringItemForm';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';

describe('<AddRecurringItemForm />', () => {
  it('renders name, category, cadence', () => {
    renderWithProviders(
      <AddRecurringItemForm open={true} onOpenChange={vi.fn()} householdId={mockHousehold._id} />,
    );
    expect(screen.getByText(/^Name$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Category$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Cadence$/i)).toBeInTheDocument();
  });

  it('submits and closes', async () => {
    server.use(
      http.post('/api/households/:id/shopping-list/recurring', () =>
        HttpResponse.json({ status: 'success', data: { rule: { _id: 'ri1' } } }),
      ),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <AddRecurringItemForm open={true} onOpenChange={onOpenChange} householdId={mockHousehold._id} />,
    );
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'Auto Milk');
    await user.click(screen.getByRole('button', { name: /add|save|create/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), { timeout: 2000 });
  });
});
