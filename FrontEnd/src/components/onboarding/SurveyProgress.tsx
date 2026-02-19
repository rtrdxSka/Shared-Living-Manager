import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Step label mapping ────────────────────────────────────────────────

const STEP_LABELS: Record<number, string> = {
  1: 'Household',
  2: 'Members',
  3: 'Finances',
  4: 'Tasks',
  5: 'Review',
};

interface SurveyProgressProps {
  /** Current active step number */
  currentStep: number;
  /** Ordered list of effective step numbers (e.g. [1,3,4,5] when step 2 is skipped) */
  effectiveSteps: number[];
}

export function SurveyProgress({
  currentStep,
  effectiveSteps,
}: SurveyProgressProps) {
  return (
    <nav aria-label="Survey progress" className="w-full">
      <ol className="flex items-center justify-between">
        {effectiveSteps.map((step, index) => {
          const isActive = step === currentStep;
          const isCompleted =
            effectiveSteps.indexOf(currentStep) > index;
          const isLast = index === effectiveSteps.length - 1;

          return (
            <li
              key={step}
              className={cn(
                'flex items-center',
                !isLast && 'flex-1'
              )}
            >
              {/* Circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    isCompleted &&
                      'border-primary bg-primary text-primary-foreground',
                    isActive &&
                      'border-primary bg-background text-primary',
                    !isActive &&
                      !isCompleted &&
                      'border-muted-foreground/30 bg-background text-muted-foreground/50'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={cn(
                    'hidden text-xs font-medium sm:block',
                    isActive && 'text-foreground',
                    isCompleted && 'text-muted-foreground',
                    !isActive &&
                      !isCompleted &&
                      'text-muted-foreground/50'
                  )}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1 rounded-full transition-colors sm:mx-3',
                    isCompleted ? 'bg-primary' : 'bg-muted-foreground/20'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}