import { useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  OnboardingContext,
  type OnboardingSurveyState,
} from './onboarding.context';
import {
  shouldSkipMemberStep,
  shouldShowSplitMethod,
  shouldShowDistributionMethod,
  type OnboardingSurveyData,
  type LivingArrangement,
} from '@/types/onboarding.types';

// ── Constants ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'housemate-onboarding-survey';

// ── Initial state per step ────────────────────────────────────────────

const initialStep1: OnboardingSurveyState['step1'] = {
  householdName: '',
  totalMembers: 1,
  livingArrangement: '',
  livingArrangementOther: '',
};

const initialStep2: OnboardingSurveyState['step2'] = {
  memberStructure: [],
};

const initialStep3: OnboardingSurveyState['step3'] = {
  expenseSplitMethod: '',
  trackedExpenseTypes: [],
  currency: 'BGN',
};

const initialStep4: OnboardingSurveyState['step4'] = {
  taskManagementEnabled: '',
  taskDistributionMethod: '',
};

const initialSurveyState: OnboardingSurveyState = {
  step1: initialStep1,
  step2: initialStep2,
  step3: initialStep3,
  step4: initialStep4,
};

// ── LocalStorage helpers ──────────────────────────────────────────────

interface PersistedData {
  currentStep: number;
  surveyState: OnboardingSurveyState;
}

function loadFromStorage(): PersistedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedData;
  } catch {
    return null;
  }
}

function saveToStorage(data: PersistedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Step navigation helpers ───────────────────────────────────────────

/**
 * Returns the ordered list of effective step numbers,
 * excluding Step 2 when arrangement is 'alone'.
 */
function getEffectiveSteps(arrangement: LivingArrangement | ''): number[] {
  const steps = [1, 2, 3, 4, 5];
  if (shouldSkipMemberStep(arrangement)) {
    return steps.filter((s) => s !== 2);
  }
  return steps;
}

// ── Provider component ────────────────────────────────────────────────

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [surveyState, setSurveyState] = useState<OnboardingSurveyState>(
    () => {
      const persisted = loadFromStorage();
      return persisted?.surveyState ?? initialSurveyState;
    }
  );

  const [currentStep, setCurrentStep] = useState<number>(() => {
    const persisted = loadFromStorage();
    return persisted?.currentStep ?? 1;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived values
  const isStep2Skipped = shouldSkipMemberStep(
    surveyState.step1.livingArrangement
  );
  const effectiveSteps = getEffectiveSteps(
    surveyState.step1.livingArrangement
  );
  const totalSteps = effectiveSteps.length;

  // ── Persist to localStorage on state change ─────────────────────────

  useEffect(() => {
    saveToStorage({ currentStep, surveyState });
  }, [currentStep, surveyState]);

  // ── Step data update ────────────────────────────────────────────────

  const updateStepData = useCallback(
    <K extends keyof OnboardingSurveyState>(
      step: K,
      data: OnboardingSurveyState[K]
    ) => {
      setSurveyState((prev) => {
        const next = { ...prev, [step]: data };

        // When livingArrangement changes, reset dependent steps
        if (step === 'step1') {
          const prevArrangement = prev.step1.livingArrangement;
          const nextStep1 = data as OnboardingSurveyState['step1'];
          const nextArrangement = nextStep1.livingArrangement;

          if (prevArrangement !== nextArrangement) {
            // Reset Step 2 member structure
            next.step2 = initialStep2;

            // Reset split method if it's no longer available
            if (next.step3.expenseSplitMethod) {
              const showSplit = shouldShowSplitMethod(nextArrangement);
              if (!showSplit) {
                next.step3 = { ...next.step3, expenseSplitMethod: '' };
              }
            }

            // Reset distribution method if it's no longer applicable
            if (next.step4.taskDistributionMethod) {
              const showDist = shouldShowDistributionMethod(
                nextArrangement,
                next.step4.taskManagementEnabled
              );
              if (!showDist) {
                next.step4 = { ...next.step4, taskDistributionMethod: '' };
              }
            }
          }

          // When totalMembers changes, reset member structure
          // (count mismatch would cause validation failure anyway)
          if (
            prevArrangement === nextArrangement &&
            prev.step1.totalMembers !== nextStep1.totalMembers
          ) {
            next.step2 = initialStep2;
          }
        }

        return next;
      });
    },
    []
  );

  // ── Navigation ──────────────────────────────────────────────────────

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const steps = getEffectiveSteps(surveyState.step1.livingArrangement);
      const currentIndex = steps.indexOf(prev);
      if (currentIndex === -1 || currentIndex >= steps.length - 1) return prev;
      return steps[currentIndex + 1];
    });
  }, [surveyState.step1.livingArrangement]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => {
      const steps = getEffectiveSteps(surveyState.step1.livingArrangement);
      const currentIndex = steps.indexOf(prev);
      if (currentIndex <= 0) return prev;
      return steps[currentIndex - 1];
    });
  }, [surveyState.step1.livingArrangement]);

  const goToStep = useCallback(
    (step: number) => {
      const steps = getEffectiveSteps(surveyState.step1.livingArrangement);
      if (steps.includes(step)) {
        setCurrentStep(step);
      }
    },
    [surveyState.step1.livingArrangement]
  );

  // ── Payload assembly ────────────────────────────────────────────────

  const buildSubmitPayload = useCallback((): OnboardingSurveyData | null => {
    const { step1, step2, step3, step4 } = surveyState;

    // Verify required fields are filled
    if (!step1.livingArrangement || !step1.householdName) return null;
    if (!step4.taskManagementEnabled) return null;
    if (step3.trackedExpenseTypes.length === 0) return null;

    const arrangement = step1.livingArrangement;
    const needsSplit = shouldShowSplitMethod(arrangement);
    const needsDistribution = shouldShowDistributionMethod(
      arrangement,
      step4.taskManagementEnabled
    );

    if (needsSplit && !step3.expenseSplitMethod) return null;
    if (needsDistribution && !step4.taskDistributionMethod) return null;

    const payload: OnboardingSurveyData = {
      // Step 1
      householdName: step1.householdName,
      totalMembers: step1.totalMembers,
      livingArrangement: arrangement,
      ...(arrangement === 'other' && step1.livingArrangementOther
        ? { livingArrangementOther: step1.livingArrangementOther }
        : {}),

      // Step 2
      memberStructure: isStep2Skipped ? [] : step2.memberStructure,

      // Step 3
      ...(needsSplit && step3.expenseSplitMethod
        ? { expenseSplitMethod: step3.expenseSplitMethod }
        : {}),
      trackedExpenseTypes: step3.trackedExpenseTypes,
      currency: step3.currency,

      // Step 4
      taskManagementEnabled: step4.taskManagementEnabled,
      ...(needsDistribution && step4.taskDistributionMethod
        ? { taskDistributionMethod: step4.taskDistributionMethod }
        : {}),
    };

    return payload;
  }, [surveyState, isStep2Skipped]);

  // ── Reset ───────────────────────────────────────────────────────────

  const resetSurvey = useCallback(() => {
    setSurveyState(initialSurveyState);
    setCurrentStep(1);
    clearStorage();
  }, []);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        totalSteps,
        surveyState,
        isStep2Skipped,
        updateStepData,
        nextStep,
        prevStep,
        goToStep,
        buildSubmitPayload,
        resetSurvey,
        isSubmitting,
        setIsSubmitting,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}