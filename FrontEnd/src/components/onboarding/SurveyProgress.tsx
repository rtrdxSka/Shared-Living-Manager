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
