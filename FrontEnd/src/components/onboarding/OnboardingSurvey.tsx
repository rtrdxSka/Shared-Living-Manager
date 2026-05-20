import type { ReactNode } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
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

// Per-step inner-content max-width. The outer shell is uniformly wide;
// the form content inside is constrained per step for readability.
const STEP_INNER_MAX: Record<number, string> = {
  1: 'max-w-2xl',
  2: 'max-w-3xl',
  3: 'max-w-2xl',
  4: 'max-w-2xl',
  5: 'max-w-3xl',
};

// ── Wizard container — centered single column, wide shell ─────────────

export function OnboardingSurvey() {
  const { currentStep, effectiveTotalSteps } = useOnboarding();
  const meta = STEP_META[currentStep];
  const innerMax = STEP_INNER_MAX[currentStep] ?? 'max-w-2xl';

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-start justify-center px-4 sm:px-6 lg:px-10 py-12">
      <div className="relative w-full max-w-6xl space-y-10">
        {/* Top header band: brand + progress + step counter */}
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
              <span className="text-accent-ink font-mono font-semibold text-sm">H</span>
            </div>
            <span className="text-sm font-semibold text-ink">HouseMate</span>
          </div>

          <SurveyProgress currentStep={currentStep} />

          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-3 whitespace-nowrap shrink-0">
            STEP {currentStep} / {effectiveTotalSteps}
          </div>
        </div>

        {/* Centered heading + helper copy */}
        <div className="text-center space-y-3 max-w-prose mx-auto">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink leading-snug">
            {meta.heading}
          </h1>
          <p className="text-sm text-ink-3 leading-relaxed">{meta.description}</p>
        </div>

        {/* Form area — wide shell, inner content max-width per step */}
        <div className={`${innerMax} mx-auto`}>
          {currentStep === 1 && <StepLivingArrangement />}
          {currentStep === 2 && <StepHouseholdStructure />}
          {currentStep === 3 && <StepFinancialPreferences />}
          {currentStep === 4 && <StepTaskPreferences />}
          {currentStep === 5 && <StepReview />}
        </div>
      </div>
    </div>
  );
}
