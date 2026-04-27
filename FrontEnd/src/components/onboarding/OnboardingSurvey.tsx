import type { ReactNode } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { BlobBack } from '@/components/ui/blob-back';
import { SurveyProgress } from './SurveyProgress';
import { StepLivingArrangement } from './steps/StepLivingArrangement';
import { StepHouseholdStructure } from './steps/StepHouseholdStructure';
import { StepFinancialPreferences } from './steps/StepFinancialPreferences';
import { StepTaskPreferences } from './steps/StepTaskPreferences';
import { StepReview } from './steps/StepReview';

// ── Step metadata ─────────────────────────────────────────────────────

const STEP_META: Record<
  number,
  { heading: ReactNode; description: string }
> = {
  1: {
    heading: (
      <>
        How do you{' '}
        <span className="font-serif italic text-accent">live</span>?
      </>
    ),
    description: 'Tell us about your household so we can tailor the experience.',
  },
  2: {
    heading: (
      <>
        Who&apos;s in your{' '}
        <span className="font-serif italic text-accent">household</span>?
      </>
    ),
    description: 'Set up your profile and describe the people you live with.',
  },
  3: {
    heading: (
      <>
        How do you want to{' '}
        <span className="font-serif italic text-accent">split</span> things?
      </>
    ),
    description: 'Choose how shared expenses should be managed and tracked.',
  },
  4: {
    heading: (
      <>
        How do you handle{' '}
        <span className="font-serif italic text-accent">chores</span>?
      </>
    ),
    description: 'Configure task tracking and how duties are distributed.',
  },
  5: {
    heading: (
      <>
        Looking{' '}
        <span className="font-serif italic text-accent">good</span>?
      </>
    ),
    description: 'Review everything before creating your household.',
  },
};

// ── All steps are always active ──────────────────────────────────────

const EFFECTIVE_STEPS = [1, 2, 3, 4, 5];

// ── Wizard container ──────────────────────────────────────────────────

export function OnboardingSurvey() {
  const { currentStep } = useOnboarding();

  const meta = STEP_META[currentStep];
  const totalSteps = EFFECTIVE_STEPS.length;

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-start justify-center px-4 py-10 overflow-hidden">
      <BlobBack className="absolute -top-20 -left-20" color="accent" size={400} />
      <BlobBack className="absolute -bottom-20 -right-20" color="cat-rent" size={350} />

      <div className="relative w-full max-w-3xl space-y-8">
        {/* Top row: brand + progress + step number */}
        <div className="flex items-center justify-between gap-6">
          {/* Brand mark */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
              <span className="text-accent-ink font-mono font-semibold text-sm">H</span>
            </div>
            <span className="text-sm font-semibold text-ink">HouseMate</span>
          </div>

          {/* Progress bar */}
          <SurveyProgress
            currentStep={currentStep}
            effectiveSteps={EFFECTIVE_STEPS}
          />

          {/* Mono step counter */}
          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-3 whitespace-nowrap shrink-0">
            STEP {currentStep} / {totalSteps}
          </div>
        </div>

        {/* Body: 2-column — heading/copy on left, step content on right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: heading + helper copy */}
          <div className="space-y-3 lg:pt-1">
            <h1 className="text-3xl font-semibold tracking-tight text-ink leading-snug">
              {meta.heading}
            </h1>
            <p className="text-sm text-ink-3 leading-relaxed">{meta.description}</p>
          </div>

          {/* Right: step form */}
          <div className="space-y-3">
            {currentStep === 1 && <StepLivingArrangement />}
            {currentStep === 2 && <StepHouseholdStructure />}
            {currentStep === 3 && <StepFinancialPreferences />}
            {currentStep === 4 && <StepTaskPreferences />}
            {currentStep === 5 && <StepReview />}
          </div>
        </div>
      </div>
    </div>
  );
}
