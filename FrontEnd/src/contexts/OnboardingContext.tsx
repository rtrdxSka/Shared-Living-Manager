import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import {
  OnboardingContext,
  type BuildPayloadResult,
  type OnboardingSurveyState,
} from './onboarding.context';
import {
  shouldShowDistributionMethod,
  type OnboardingSurveyData,
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
  creatorProfile: {
    nickname: '',
    ageGroup: 'adult',
    participatesInFinances: true,
    participatesInTasks: true,
  },
  memberStructure: [],
};

const initialStep3: OnboardingSurveyState['step3'] = {
  financeMode: '',
  expenseSplitMethod: '',
  trackedExpenseTypes: [],
  currency: 'EUR',
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
    // Strip email fields to avoid persisting PII (member emails) in localStorage
    const raw = JSON.stringify(data, (key, value) => {
      if (key === 'email') return undefined;
      return value;
    });
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage full or unavailable — fail silently
  }
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Step navigation helpers ───────────────────────────────────────────

/** Step 2 always shows (creator profile). All 5 steps are always active. */
function getEffectiveSteps(): number[] {
  return [1, 2, 3, 4, 5];
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
  const effectiveSteps = getEffectiveSteps();
  const totalSteps = effectiveSteps.length;
  const isAlone = surveyState.step1.livingArrangement === 'alone';

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

            // Reset finance mode and split method when switching to/from solo
            if (nextArrangement === 'alone' || prevArrangement === 'alone') {
              next.step3 = { ...next.step3, financeMode: '', expenseSplitMethod: '' };
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
      const steps = getEffectiveSteps();
      const currentIndex = steps.indexOf(prev);
      if (currentIndex === -1 || currentIndex >= steps.length - 1) return prev;
      return steps[currentIndex + 1];
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => {
      const steps = getEffectiveSteps();
      const currentIndex = steps.indexOf(prev);
      if (currentIndex <= 0) return prev;
      return steps[currentIndex - 1];
    });
  }, []);

  const goToStep = useCallback((step: number) => {
    const steps = getEffectiveSteps();
    if (steps.includes(step)) {
      setCurrentStep(step);
    }
  }, []);

  // ── Payload assembly ────────────────────────────────────────────────

  const buildSubmitPayload = useCallback((): BuildPayloadResult => {
    const { step1, step2, step3, step4 } = surveyState;

    // Verify required fields are filled — return the *first* missing field
    // we encounter so the caller can deep-link the user back to it.
    if (!step1.livingArrangement) {
      return { kind: 'missing', stepIndex: 1, fieldName: 'livingArrangement' };
    }
    if (!step1.householdName) {
      return { kind: 'missing', stepIndex: 1, fieldName: 'householdName' };
    }
    if (!step2.creatorProfile.nickname) {
      return { kind: 'missing', stepIndex: 2, fieldName: 'creatorProfile.nickname' };
    }
    if (step3.trackedExpenseTypes.length === 0) {
      return { kind: 'missing', stepIndex: 3, fieldName: 'trackedExpenseTypes' };
    }
    if (!step4.taskManagementEnabled) {
      return { kind: 'missing', stepIndex: 4, fieldName: 'taskManagementEnabled' };
    }

    const arrangement = step1.livingArrangement;
    const isNonSolo = arrangement !== 'alone';
    const needsFinanceMode = isNonSolo;
    const needsSplit = isNonSolo && step3.financeMode === 'split';
    const needsDistribution = shouldShowDistributionMethod(
      arrangement,
      step4.taskManagementEnabled
    );

    if (needsFinanceMode && !step3.financeMode) {
      return { kind: 'missing', stepIndex: 3, fieldName: 'financeMode' };
    }
    if (needsSplit && !step3.expenseSplitMethod) {
      return { kind: 'missing', stepIndex: 3, fieldName: 'expenseSplitMethod' };
    }
    if (needsDistribution && !step4.taskDistributionMethod) {
      return { kind: 'missing', stepIndex: 4, fieldName: 'taskDistributionMethod' };
    }

    const payload: OnboardingSurveyData = {
      // Step 1
      householdName: step1.householdName,
      totalMembers: step1.totalMembers,
      livingArrangement: arrangement,
      ...(arrangement === 'other' && step1.livingArrangementOther
        ? { livingArrangementOther: step1.livingArrangementOther }
        : {}),

      // Step 2
      creatorProfile: step2.creatorProfile,
      memberStructure: isAlone ? [] : step2.memberStructure,

      // Step 3
      ...(isNonSolo && step3.financeMode
        ? { financeMode: step3.financeMode }
        : {}),
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

    return { kind: 'ok', payload };
  }, [surveyState, isAlone]);

  // ── Effective step count ────────────────────────────────────────────
  // Today all five steps are answered in every arrangement we support.
  // Centralizing the derivation here lets future arrangements (e.g. a flow
  // that fully skips a step) return < 5 without touching consumers. The
  // deps look "unused" today but are listed intentionally so the value
  // recomputes if a future branch reads them.
  const effectiveTotalSteps = useMemo<number>(() => {
    return 5;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyState.step1.livingArrangement, surveyState.step4.taskManagementEnabled]);

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
        effectiveTotalSteps,
        surveyState,
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