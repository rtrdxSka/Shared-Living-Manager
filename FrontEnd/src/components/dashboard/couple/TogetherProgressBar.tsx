import { fmt } from '@/utils/dashboardHelpers';

interface Props {
  /** Current user's total contributions toward the goal. */
  mine: number;
  /** Partner's total contributions toward the goal. */
  partner: number;
  myLabel: string;
  partnerLabel: string;
  /** Goal target — the bar fills relative to this. */
  target: number;
  currency: string;
}

/**
 * Two-segment progress bar for couple goals: the current user's contribution
 * and their partner's, shown as ADDITIVE effort building toward the target.
 * Deliberately framed as teamwork ("we built this together"), never as debt.
 */
export default function TogetherProgressBar({
  mine,
  partner,
  myLabel,
  partnerLabel,
  target,
  currency,
}: Props) {
  const total = mine + partner;
  const denom = target > 0 ? target : total;

  let minePct = denom > 0 ? (mine / denom) * 100 : 0;
  let partnerPct = denom > 0 ? (partner / denom) * 100 : 0;

  // Overflow (contributed past target) → scale both to fill the track exactly,
  // preserving each partner's relative share.
  const sum = minePct + partnerPct;
  if (sum > 100) {
    minePct = (minePct / sum) * 100;
    partnerPct = (partnerPct / sum) * 100;
  }

  return (
    <div>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`${myLabel} contributed ${fmt(mine)} ${currency}, ${partnerLabel} contributed ${fmt(partner)} ${currency}`}
      >
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${minePct}%` }}
          data-testid="together-bar-mine"
        />
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${partnerPct}%` }}
          data-testid="together-bar-partner"
        />
      </div>
      <div
        className="mt-2 flex items-center gap-3 text-xs text-ink-3"
        data-testid="together-legend"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          {myLabel} {fmt(mine)} {currency}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          {partnerLabel} {fmt(partner)} {currency}
        </span>
      </div>
    </div>
  );
}
