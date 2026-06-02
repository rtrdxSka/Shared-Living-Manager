import { useEffect } from 'react';
import type { Milestone } from '@/utils/goalPlanner';

interface Props {
  /** The milestone just crossed, or null to render nothing. */
  milestone: Milestone | null;
  goalName: string;
  onDone: () => void;
  /** Auto-dismiss delay (ms). Overridable for tests. */
  durationMs?: number;
}

const COPY: Record<Milestone, { emoji: string; headline: string }> = {
  25: { emoji: '🌱', headline: 'Off to a great start!' },
  50: { emoji: '⛰️', headline: 'Halfway there — together!' },
  75: { emoji: '🚀', headline: 'So close now!' },
  100: { emoji: '🎉', headline: 'Goal reached!' },
};

/**
 * A lightweight, self-contained celebration moment fired when a contribution
 * pushes a shared goal past 25/50/75/100%. Fixed overlay (no toast library),
 * auto-dismisses, and is dismissible by clicking. Pure delight — it reinforces
 * the couple's shared progress.
 */
export default function GoalMilestoneCelebration({
  milestone,
  goalName,
  onDone,
  durationMs = 2600,
}: Props) {
  useEffect(() => {
    if (milestone === null) return;
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [milestone, durationMs, onDone]);

  if (milestone === null) return null;

  const { emoji, headline } = COPY[milestone];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 pointer-events-none"
      role="status"
      aria-live="polite"
      data-testid="milestone-celebration"
    >
      <button
        type="button"
        onClick={onDone}
        className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-3 shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-500"
      >
        <span className="text-3xl leading-none" aria-hidden>{emoji}</span>
        <span className="text-left">
          <span className="block text-sm font-semibold text-ink">{headline}</span>
          <span className="block text-xs text-ink-3">
            {milestone === 100
              ? `You both fully funded ${goalName}.`
              : `${goalName} is ${milestone}% funded.`}
          </span>
        </span>
      </button>
    </div>
  );
}
