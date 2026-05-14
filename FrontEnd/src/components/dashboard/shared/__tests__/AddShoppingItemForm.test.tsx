import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AddShoppingItemForm from '@/components/dashboard/shared/AddShoppingItemForm';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';

describe('<AddShoppingItemForm />', () => {
  it('renders required fields', () => {
    renderWithProviders(
      <AddShoppingItemForm open={true} onOpenChange={vi.fn()} householdId={mockHousehold._id} />,
    );
    expect(screen.getByText(/name/i)).toBeInTheDocument();
    expect(screen.getByText(/category/i)).toBeInTheDocument();
  });

  it('submits and closes', async () => {
    server.use(
      http.post('/api/households/:id/shopping-list', () =>
        HttpResponse.json({ status: 'success', data: { item: { _id: 'i1', name: 'Milk', category: 'groceries' } } }),
      ),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <AddShoppingItemForm open={true} onOpenChange={onOpenChange} householdId={mockHousehold._id} />,
    );
    const name = screen.getAllByRole('textbox')[0];
    await user.type(name, 'Milk');
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
