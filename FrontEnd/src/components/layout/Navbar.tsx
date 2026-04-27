import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, LogOut, Sun, Moon } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';

export default function Navbar() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { toggleTheme } = useTheme();

  const dashboardLink =
    isAuthenticated && user && user.households.length > 0
      ? '/dashboard/overview'
      : '/get-started';

  // Close mobile sheet when resizing past the md breakpoint
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handler = () => {
      if (mediaQuery.matches) setIsSheetOpen(false);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handleLogout = async () => {
    setIsSheetOpen(false);
    await logout();
    navigate('/', { replace: true });
  };

  const handleMobileLink = () => {
    setIsSheetOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg-sub/80 backdrop-blur-lg supports-[backdrop-filter]:bg-bg-sub/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
            <span className="font-mono font-semibold text-sm text-accent-ink">H</span>
          </div>
          <span className="font-semibold text-base text-ink font-sans">HouseMate</span>
        </Link>

        {/* Center marketing nav — only when not authenticated, desktop only */}
        {!isLoading && !isAuthenticated && (
          <nav className="hidden md:flex items-center gap-7">
            <a href="#" onClick={(e) => e.preventDefault()} aria-disabled="true" tabIndex={-1} className="text-sm text-ink-3 hover:text-ink transition-colors">How it works</a>
            <a href="#" onClick={(e) => e.preventDefault()} aria-disabled="true" tabIndex={-1} className="text-sm text-ink-3 hover:text-ink transition-colors">Pricing</a>
            <a href="#" onClick={(e) => e.preventDefault()} aria-disabled="true" tabIndex={-1} className="text-sm text-ink-3 hover:text-ink transition-colors">Stories</a>
            <a href="#" onClick={(e) => e.preventDefault()} aria-disabled="true" tabIndex={-1} className="text-sm text-ink-3 hover:text-ink transition-colors">Help</a>
          </nav>
        )}

        {/* Desktop navigation — right side */}
        {!isLoading && (
          <nav className="hidden items-center gap-3 md:flex">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-xl"
              onClick={toggleTheme}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            {isAuthenticated ? (
              <>
                <span className="text-sm font-medium text-ink-2">
                  {user?.firstName} {user?.lastName}
                </span>
                <Button asChild variant="ghost" size="sm">
                  <Link to={dashboardLink}>Dashboard</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/profile">Profile</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/register">Start free</Link>
                </Button>
              </>
            )}
          </nav>
        )}

        {/* Mobile hamburger */}
        {!isLoading && (
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-72 sm:w-80">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>

              <div className="flex flex-col gap-6 pt-8">
                {/* Brand in sheet */}
                <Link
                  to="/"
                  onClick={handleMobileLink}
                  className="flex items-center gap-3 transition-opacity hover:opacity-80"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
                    <span className="font-mono font-semibold text-sm text-accent-ink">H</span>
                  </div>
                  <span className="font-semibold text-base text-ink font-sans">HouseMate</span>
                </Link>

                <div className="h-px bg-line" />

                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium text-ink-2">Theme</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-xl"
                    onClick={toggleTheme}
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                  </Button>
                </div>

                <div className="h-px bg-line" />

                {/* Mobile links */}
                <nav className="flex flex-col gap-2">
                  {isAuthenticated ? (
                    <>
                      <div className="px-3 py-2 text-sm font-medium text-ink-2">
                        {user?.firstName} {user?.lastName}
                      </div>
                      <Button
                        asChild
                        variant="ghost"
                        className="h-11 justify-start rounded-lg"
                      >
                        <Link to={dashboardLink} onClick={handleMobileLink}>
                          Dashboard
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        className="h-11 justify-start rounded-lg"
                      >
                        <Link to="/profile" onClick={handleMobileLink}>
                          Profile
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-11 justify-start gap-2 rounded-lg text-neg hover:text-neg"
                        onClick={() => void handleLogout()}
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        asChild
                        variant="ghost"
                        className="h-11 justify-start rounded-lg"
                      >
                        <Link to="/login" onClick={handleMobileLink}>
                          Sign in
                        </Link>
                      </Button>
                      <Button
                        asChild
                        className="h-11 justify-start rounded-lg"
                      >
                        <Link to="/register" onClick={handleMobileLink}>
                          Start free
                        </Link>
                      </Button>
                    </>
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </header>
  );
}
