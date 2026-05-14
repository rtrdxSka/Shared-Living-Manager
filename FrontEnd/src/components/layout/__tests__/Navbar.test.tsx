import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import Navbar from '@/components/layout/Navbar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { renderWithProviders } from '@/test/utils/renderWithProviders';

// jsdom does not implement window.matchMedia — provide a minimal stub.
const makeMatchMediaMock = (matches = false) =>
  vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

// renderWithProviders does NOT include ThemeProvider, so we wrap explicitly.
// AuthContext starts with isLoading=true and resolves after the /api/auth/refresh
// fetch completes (MSW returns 401, so the user stays unauthenticated).
// The Navbar only renders its buttons once isLoading becomes false,
// so we must use findBy* (async) queries to wait for that transition.
const renderInTheme = (defaultTheme: 'light' | 'dark' = 'light') =>
  renderWithProviders(
    <ThemeProvider defaultTheme={defaultTheme}>
      <Navbar />
    </ThemeProvider>,
  );

describe('<Navbar /> theme toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    // Stub matchMedia: prefers-color-scheme: dark → false (light system preference)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: makeMatchMediaMock(false),
    });
  });

  it('renders a theme toggle control', async () => {
    renderInTheme('light');
    // findByRole waits for the element to appear (auth isLoading resolves first)
    const toggle = await screen.findByRole('button', { name: /toggle theme/i });
    expect(toggle).toBeInTheDocument();
  });

  it('clicking the theme toggle flips html.classList between light and dark', async () => {
    renderInTheme('light');
    // ThemeProvider applies the class in a useEffect — it runs on first render
    // with defaultTheme='light', so 'light' is added to documentElement.
    const toggle = await screen.findByRole('button', { name: /toggle theme/i });
    expect(document.documentElement.classList.contains('light')).toBe(true);

    const user = userEvent.setup();
    await user.click(toggle);

    // toggleTheme: 'light' → setTheme('dark') → ThemeProvider useEffect adds 'dark'
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
