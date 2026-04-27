import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Coins, RefreshCw, Target, Heart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BlobBack } from '@/components/ui/blob-back';
import { CategoryChip } from '@/components/ui/category-chip';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { MoneyAmount } from '@/components/ui/money-amount';
import { useAuth } from '@/hooks/useAuth';

// ── Local FeatureCard ────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 hover:border-line-2 transition-colors">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 mb-4">
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <h3 className="text-sm font-semibold text-ink mb-2">{title}</h3>
      <p className="text-xs text-ink-3 leading-relaxed">{desc}</p>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();

  const dashboardLink =
    isAuthenticated && user && user.households.length > 0
      ? '/dashboard'
      : '/get-started';

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
            {/* Left column */}
            <div className="space-y-7">
              {/* Pill chip */}
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                For two-person households
              </div>

              {/* H1 */}
              <h1 className="text-5xl sm:text-6xl lg:text-[72px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
                Money &amp; chores,
                <br />
                <span className="font-serif italic text-accent text-[1.05em]">
                  without the spreadsheet.
                </span>
              </h1>

              {/* Subhead */}
              <p className="max-w-[520px] text-lg text-ink-2 leading-relaxed">
                HouseMate handles the awkward conversations — splits,
                settle-ups, who-does-the-laundry — so you can stay good to each
                other.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3">
                {isAuthenticated ? (
                  <Button asChild size="lg" className="shadow-accent-glow">
                    <Link to={dashboardLink}>
                      Go to app <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg" className="shadow-accent-glow">
                      <Link to="/register">
                        Start free — 2 minutes{' '}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="ghost">
                      <a
                        href="#how-it-works"
                        onClick={(e) => e.preventDefault()}
                      >
                        See how it works →
                      </a>
                    </Button>
                  </>
                )}
              </div>

              {/* Three meta dots */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3 font-mono uppercase tracking-[0.14em]">
                <span>No credit card</span>
                <span className="text-ink-4">·</span>
                <span>Free for 2 people forever</span>
                <span className="text-ink-4">·</span>
                <span>End-to-end encrypted</span>
              </div>
            </div>

            {/* Right column — tilted macOS-style window mock */}
            <div className="relative">
              <BlobBack
                className="absolute -top-8 -right-8"
                color="accent"
                size={320}
              />
              <BlobBack
                className="absolute -bottom-12 -left-8"
                color="cat-rent"
                size={240}
              />

              <div className="relative rounded-2xl border border-line bg-surface shadow-hero overflow-hidden -rotate-[1.5deg] hover:rotate-0 transition-transform duration-500">
                {/* Mac traffic-light header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-bg-sub">
                  <div className="h-3 w-3 rounded-full bg-neg" />
                  <div className="h-3 w-3 rounded-full bg-warn" />
                  <div className="h-3 w-3 rounded-full bg-pos" />
                  <span className="ml-3 text-[11px] font-mono text-ink-3">
                    housemate.app/dashboard/overview
                  </span>
                </div>

                {/* Mock overview snapshot */}
                <div className="p-6 space-y-4">
                  <EyebrowLabel as="div">
                    THE CURRENT STATE OF THINGS
                  </EyebrowLabel>
                  <p className="text-2xl text-ink-2 leading-tight">
                    <span className="font-serif italic text-accent">Sam</span>{' '}
                    owes you
                  </p>
                  <MoneyAmount amount={142.4} currency="€" size="hero" />

                  <div className="space-y-2 pt-4 border-t border-line">
                    {[
                      { cat: 'rent', desc: 'June rent', amount: 800 },
                      {
                        cat: 'groceries',
                        desc: 'Groceries — Albert Heijn',
                        amount: 67.4,
                      },
                      {
                        cat: 'utilities',
                        desc: 'Internet — KPN',
                        amount: 35,
                      },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <CategoryChip category={row.cat as 'rent' | 'groceries' | 'utilities'} />
                        <span className="flex-1 text-sm text-ink truncate">
                          {row.desc}
                        </span>
                        <MoneyAmount
                          amount={row.amount}
                          currency="€"
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features strip ────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-bg-sub py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={Coins}
              title="Fair splits"
              desc="Equal, income-based, or per-expense — your call. Math stays out of the way."
            />
            <FeatureCard
              icon={RefreshCw}
              title="Chore rotations"
              desc="Weekly cycles or AI-balanced delegation. Nobody forgets whose turn it is."
            />
            <FeatureCard
              icon={Target}
              title="Joint goals"
              desc="Save together for the apartment, the trip, the rainy day. Watch the bar fill up."
            />
            <FeatureCard
              icon={Heart}
              title="Stays civil"
              desc="Settle-up nudges and a tone that's calm — not transactional. Built for long-term."
            />
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      {!isAuthenticated && (
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
              Two minutes.{' '}
              <span className="font-serif italic text-accent">
                Then you're done.
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-ink-2">
              No credit card. No setup wizard. Just sign up and invite your
              person.
            </p>
            <Button asChild size="lg" className="mt-8 shadow-accent-glow">
              <Link to="/register">
                Start free <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-ink-3">
          <span>HouseMate &copy; {new Date().getFullYear()}</span>
          <span className="uppercase tracking-[0.14em]">Masters Project</span>
        </div>
      </footer>
    </div>
  );
}
