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
      ? '/dashboard'
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
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 text-xl font-bold tracking-tight transition-opacity hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">H</span>
          </div>
          HouseMate
        </Link>

        {/* Desktop navigation */}
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
                <span className="text-sm font-medium text-muted-foreground">
                  {user?.firstName} {user?.lastName}
                </span>
                <Button asChild variant="ghost" size="sm" className="h-9 rounded-xl">
                  <Link to={dashboardLink}>Dashboard</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 rounded-xl"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="h-9 rounded-xl">
                  <Link to="/login">Login</Link>
                </Button>
                <Button asChild size="sm" className="h-9 rounded-xl px-4 shadow-sm">
                  <Link to="/register">Register</Link>
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
                {/* Logo in sheet */}
                <Link
                  to="/"
                  onClick={handleMobileLink}
                  className="flex items-center gap-2 text-lg font-bold tracking-tight"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <span className="text-sm font-bold text-primary-foreground">H</span>
                  </div>
                  HouseMate
                </Link>

                <div className="h-px bg-border" />

                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium text-muted-foreground">Theme</span>
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

                <div className="h-px bg-border" />

                {/* Mobile links */}
                <nav className="flex flex-col gap-2">
                  {isAuthenticated ? (
                    <>
                      <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                        {user?.firstName} {user?.lastName}
                      </div>
                      <Button
                        asChild
                        variant="ghost"
                        className="h-11 justify-start rounded-xl"
                      >
                        <Link to={dashboardLink} onClick={handleMobileLink}>
                          Dashboard
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-11 justify-start gap-2 rounded-xl text-destructive hover:text-destructive"
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
                        className="h-11 justify-start rounded-xl"
                      >
                        <Link to="/login" onClick={handleMobileLink}>
                          Login
                        </Link>
                      </Button>
                      <Button
                        asChild
                        className="h-11 justify-start rounded-xl shadow-sm"
                      >
                        <Link to="/register" onClick={handleMobileLink}>
                          Register
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
