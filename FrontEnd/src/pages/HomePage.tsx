import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Receipt,
  Users,
  Brain,
  ClipboardList,
  ArrowRight,
  BarChart3,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();

  const dashboardLink =
    isAuthenticated && user && user.households.length > 0
      ? '/dashboard'
      : '/get-started';

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pb-28 sm:pt-28 lg:px-8 lg:pb-36 lg:pt-36">
          <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm">
            <Brain className="h-4 w-4" />
            Powered by intelligent cost splitting
          </div>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Manage household expenses and chores{' '}
            <span className="bg-gradient-to-r from-foreground/80 to-muted-foreground bg-clip-text text-transparent">
              effortlessly
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground sm:mt-10 sm:text-lg">
            A collaborative platform for managing finances and household tasks.
            Fair splitting, transparency, and peace of mind — whether you live
            with a partner, family, or roommates.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:gap-4">
            {isAuthenticated ? (
              <Button asChild size="lg" className="h-12 rounded-xl px-8 text-base shadow-md">
                <Link to={dashboardLink}>
                  Go to app
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="h-12 rounded-xl px-8 text-base shadow-md">
                  <Link to="/register">
                    Get started free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 rounded-xl px-8 text-base">
                  <Link to="/login">I already have an account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mb-12 text-center sm:mb-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Everything you need in one place
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              An adaptive platform that adjusts to your way of living.
            </p>
          </div>

          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
            <FeatureCard
              icon={Receipt}
              title="Expense Tracking"
              description="Add and categorize shared expenses. See who paid what and who owes whom."
            />
            <FeatureCard
              icon={Brain}
              title="Fair Splitting"
              description="A fair cost-splitting algorithm based on Shapley Value."
            />
            <FeatureCard
              icon={BarChart3}
              title="Forecasts & Analytics"
              description="Forecast future bills and review spending analytics by category and time."
            />
            <FeatureCard
              icon={ClipboardList}
              title="Task Management"
              description="Rotation, fixed assignment, or intelligently optimized delegation of household chores."
            />
            <FeatureCard
              icon={Users}
              title="Flexible Households"
              description="Support for couples, families, roommates, and even multiple families under one roof."
            />
            <FeatureCard
              icon={Shield}
              title="Security"
              description="Encrypted passwords, JWT authentication, and protection for all sensitive data."
            />
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      {!isAuthenticated && (
        <section className="border-t border-border/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
            <div className="w-full max-w-3xl rounded-2xl border border-border/60 bg-card p-8 shadow-sm sm:p-12 lg:p-16">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Ready to get started?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
                Create an account in seconds and set up your household through
                our personalized onboarding process.
              </p>
              <Button asChild size="lg" className="mt-8 h-12 rounded-xl px-8 text-base shadow-md sm:mt-10">
                <Link to="/register">
                  Sign up free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-border/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <span className="font-medium">HouseMate &copy; {new Date().getFullYear()}</span>
          <span>Masters Project</span>
        </div>
      </footer>
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="group flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-lg sm:p-8">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 transition-colors group-hover:bg-primary/10">
        <Icon className="h-6 w-6 text-foreground/80" />
      </div>
      <h3 className="mb-3 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
