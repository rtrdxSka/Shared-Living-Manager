import { createContext } from 'react';
import type {
  StepLivingArrangement,
  StepHouseholdStructure,
  StepFinancialPreferences,
  StepTaskPreferences,
  OnboardingSurveyData,
} from '@/types/onboarding.types';

// ── Survey state held across all steps ────────────────────────────────

export interface OnboardingSurveyState {
  step1: StepLivingArrangement;
  step2: StepHouseholdStructure;
  step3: StepFinancialPreferences;
  step4: StepTaskPreferences;
}

// ── Context value exposed to consumers ────────────────────────────────

export interface OnboardingContextValue {
  /** Current active step (1–5) */
  currentStep: number;

  /** Total number of effective steps (4 or 5 depending on skip logic) */
  totalSteps: number;

  /** Per-step data */
  surveyState: OnboardingSurveyState;

  /** Whether Step 2 (Household Structure) is skipped */
  isStep2Skipped: boolean;

  /** Update a single step's data and persist to localStorage */
  updateStepData: <K extends keyof OnboardingSurveyState>(
    step: K,
    data: OnboardingSurveyState[K]
  ) => void;

  /** Navigate to next effective step (skips Step 2 for 'alone') */
  nextStep: () => void;

  /** Navigate to previous effective step */
  prevStep: () => void;

  /** Jump to a specific step (used by Review "Edit" buttons) */
  goToStep: (step: number) => void;

  /** Assemble the final payload from all steps. Returns null if data is incomplete. */
  buildSubmitPayload: () => OnboardingSurveyData | null;

  /** Clear all survey data and reset to Step 1 */
  resetSurvey: () => void;

  /** Whether a submission is in progress */
  isSubmitting: boolean;

  /** Set submission state (managed by the component that calls the API) */
  setIsSubmitting: (value: boolean) => void;
}

export const OnboardingContext = createContext<
  OnboardingContextValue | undefined
>(undefined);