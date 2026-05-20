import { useOnboarding } from '@/hooks/useOnboarding';

interface SurveyProgressProps {
  /** Current active step number */
  currentStep: number;
}

export function SurveyProgress({ currentStep }: SurveyProgressProps) {
  // Segment count is sourced from the centralized `effectiveTotalSteps` so
  // arrangements that skip a step adjust here automatically.
  const { effectiveTotalSteps } = useOnboarding();

  // Build sequential step numbers [1..effectiveTotalSteps]. Renders contiguous
  // 1-based indices today; if a future arrangement skips a step entirely the
  // context can publish a distinct list and this component can adapt.
  const effectiveSteps = Array.from(
    { length: effectiveTotalSteps },
    (_, i) => i + 1,
  );
  const currentIndex = effectiveSteps.indexOf(currentStep);

  return (
    <div className="flex items-center gap-1.5 flex-1 mx-6">
      {effectiveSteps.map((step, i) => (
        <span
          key={step}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i <= currentIndex ? 'bg-accent' : 'bg-line'
          }`}
        />
      ))}
    </div>
  );
}
