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

// ── Build-payload result ──────────────────────────────────────────────

/** Result of `buildSubmitPayload`. `missing` carries enough information for
 *  the caller to highlight the offending step and field. */
export type BuildPayloadResult =
  | { kind: 'ok'; payload: OnboardingSurveyData }
  | { kind: 'missing'; stepIndex: number; fieldName: string };

// ── Context value exposed to consumers ────────────────────────────────

export interface OnboardingContextValue {
  /** Current active step (1–5) */
  currentStep: number;

  /** Total number of steps (always 5) */
  totalSteps: number;

  /** Effective number of steps for the active arrangement.
   *  Centralized here so future arrangements that skip a step adjust this
   *  value without changing consumers. Today all flows answer 5 steps. */
  effectiveTotalSteps: number;

  /** Per-step data */
  surveyState: OnboardingSurveyState;

  /** Update a single step's data and persist to localStorage */
  updateStepData: <K extends keyof OnboardingSurveyState>(
    step: K,
    data: OnboardingSurveyState[K]
  ) => void;

  /** Navigate to next step */
  nextStep: () => void;

  /** Navigate to previous step */
  prevStep: () => void;

  /** Jump to a specific step (used by Review "Edit" buttons) */
  goToStep: (step: number) => void;

  /** Assemble the final payload from all steps. Returns a discriminated
   *  union — `{ kind: 'ok', payload }` on success, or
   *  `{ kind: 'missing', stepIndex, fieldName }` when a required field is
   *  blank. Callers should branch on `kind` and surface the missing field. */
  buildSubmitPayload: () => BuildPayloadResult;

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