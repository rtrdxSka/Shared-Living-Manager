import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AppLayout from '@/components/layout/AppLayout';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import {
  mockHouseholdRoommatesJoint,
  mockHouseholdRoommatesSplit,
} from '@/test/mocks/data/households';
import { mockUsers } from '@/test/mocks/data/users';

// jsdom does not implement window.matchMedia — provide a minimal stub.
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Stub all endpoints that DashboardProvider fires on mount so MSW's
  // onUnhandledRequest: 'error' strategy does not fail the test suite.
  server.use(
    http.get('/api/households/:id/expenses', () =>
      HttpResponse.json({ status: 'success', data: { items: [], total: 0, nextCursor: null } }),
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
});

// renderWithProviders already wraps in MemoryRouter — no extra router needed.
function renderLayout(
  household: typeof mockHouseholdRoommatesJoint
) {
  return renderWithProviders(
    <ThemeProvider defaultTheme="light">
      <DashboardProvider household={household} currentUserId={mockUsers.alice._id}>
        <AppLayout>
          <div>content</div>
        </AppLayout>
      </DashboardProvider>
    </ThemeProvider>
  );
}

describe('<AppLayout /> nav items', () => {
  it('includes an Account link for roommates in joint mode', async () => {
    renderLayout(mockHouseholdRoommatesJoint);
    // findAllByRole because the layout renders both desktop sidebar AND mobile bottom-nav.
    const links = await screen.findAllByRole('link', { name: /account/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((a) => a.getAttribute('href') === '/dashboard/account')).toBe(true);
  });

  it('does not include an Account link for roommates in split mode', async () => {
    renderLayout(mockHouseholdRoommatesSplit);
    // Wait for the layout to mount by querying for a stable link, then assert no Account link.
    await screen.findAllByRole('link', { name: /overview/i });
    expect(screen.queryByRole('link', { name: /account/i })).toBeNull();
  });
});
