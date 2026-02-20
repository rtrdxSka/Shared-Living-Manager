import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Users } from 'lucide-react';

import { useOnboarding } from '@/hooks/useOnboarding';
import {
  createStepHouseholdStructureSchema,
  type StepHouseholdStructureData,
} from '@/schemas/onboarding.schemas';
import {
  RELATIONSHIP_OPTIONS,
  AGE_GROUP_OPTIONS,
  getDefaultRelationships,
  getDefaultAgeGroup,
  type LivingArrangement,
  type MemberStructureEntry,
} from '@/types/onboarding.types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SurveyNavigation } from '../SurveyNavigation';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────

function createEmptyMember(
  arrangement: LivingArrangement | ''
): MemberStructureEntry {
  const defaults = getDefaultRelationships(arrangement);
  return {
    nickname: '',
    relationship: defaults[0] ?? 'other',
    ageGroup: getDefaultAgeGroup(arrangement),
    participatesInFinances: true,
    participatesInTasks: true,
    ...(arrangement === 'multi_family' ? { familyGroup: '' } : {}),
  };
}

// ── Component ─────────────────────────────────────────────────────────

export function StepHouseholdStructure() {
  const { surveyState, updateStepData, nextStep, prevStep } = useOnboarding();

  const arrangement = surveyState.step1.livingArrangement;
  const totalMembers = surveyState.step1.totalMembers;
  const expectedCount = totalMembers - 1;

  const schema = createStepHouseholdStructureSchema(arrangement, totalMembers);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StepHouseholdStructureData>({
    resolver: zodResolver(schema),
    defaultValues: {
      memberStructure:
        surveyState.step2.memberStructure.length === expectedCount
          ? surveyState.step2.memberStructure
          : Array.from({ length: expectedCount }, () =>
              createEmptyMember(arrangement)
            ),
    },
  });

  const { fields } = useFieldArray({
    control,
    name: 'memberStructure',
  });

  const members = watch('memberStructure');

  // Auto-disable finances for children
  useEffect(() => {
    members.forEach((member, index) => {
      if (member.ageGroup === 'child' && member.participatesInFinances) {
        setValue(`memberStructure.${index}.participatesInFinances`, false, {
          shouldValidate: true,
        });
      }
    });
  }, [members, setValue]);

  const onSubmit = (data: StepHouseholdStructureData) => {
    updateStepData('step2', { memberStructure: data.memberStructure });
    nextStep();
  };

  const isMultiFamily = arrangement === 'multi_family';

  // Filter relationship options per arrangement
  const defaultRelationships = getDefaultRelationships(arrangement);
  const relationshipOptions = RELATIONSHIP_OPTIONS.filter(
    (opt) =>
      defaultRelationships.includes(opt.value) || opt.value === 'other'
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-4">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Describe the{' '}
          <span className="font-medium text-foreground">
            {expectedCount} other {expectedCount === 1 ? 'person' : 'people'}
          </span>{' '}
          in your household. You can use nicknames.
        </p>
      </div>

      {/* Member cards */}
      <div className="space-y-4">
        {fields.map((field, index) => {
          const memberErrors = errors.memberStructure?.[index];
          const isChild = members[index]?.ageGroup === 'child';

          return (
            <div
              key={field.id}
              className="rounded-xl border border-border/60 p-4 sm:p-5"
            >
              <p className="mb-4 text-sm font-semibold text-foreground">
                Member {index + 1}
              </p>

              <div className="space-y-4">
                {/* Nickname + Relationship */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`member-${index}-nickname`}>
                      Nickname
                    </Label>
                    <Input
                      id={`member-${index}-nickname`}
                      placeholder="e.g. Ivan"
                      className={cn(
                        memberErrors?.nickname && 'border-destructive'
                      )}
                      {...register(`memberStructure.${index}.nickname`)}
                    />
                    {memberErrors?.nickname && (
                      <p className="text-sm text-destructive">
                        {memberErrors.nickname.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`member-${index}-relationship`}>
                      Relationship
                    </Label>
                    <Controller
                      name={`memberStructure.${index}.relationship`}
                      control={control}
                      render={({ field: selectField }) => (
                        <select
                          id={`member-${index}-relationship`}
                          className={cn(
                            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            memberErrors?.relationship && 'border-destructive'
                          )}
                          value={selectField.value}
                          onChange={selectField.onChange}
                        >
                          {relationshipOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                    {memberErrors?.relationship && (
                      <p className="text-sm text-destructive">
                        {memberErrors.relationship.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Age Group + Family Group (conditional) */}
                <div
                  className={cn(
                    'grid grid-cols-1 gap-4',
                    isMultiFamily && 'sm:grid-cols-2'
                  )}
                >
                  <div className="space-y-2">
                    <Label htmlFor={`member-${index}-ageGroup`}>
                      Age group
                    </Label>
                    <Controller
                      name={`memberStructure.${index}.ageGroup`}
                      control={control}
                      render={({ field: selectField }) => (
                        <select
                          id={`member-${index}-ageGroup`}
                          className={cn(
                            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            memberErrors?.ageGroup && 'border-destructive'
                          )}
                          value={selectField.value}
                          onChange={selectField.onChange}
                        >
                          {AGE_GROUP_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                    {memberErrors?.ageGroup && (
                      <p className="text-sm text-destructive">
                        {memberErrors.ageGroup.message}
                      </p>
                    )}
                  </div>

                  {isMultiFamily && (
                    <div className="space-y-2">
                      <Label htmlFor={`member-${index}-familyGroup`}>
                        Family group
                      </Label>
                      <Input
                        id={`member-${index}-familyGroup`}
                        placeholder="e.g. Family A"
                        className={cn(
                          memberErrors?.familyGroup && 'border-destructive'
                        )}
                        {...register(`memberStructure.${index}.familyGroup`)}
                      />
                      {memberErrors?.familyGroup && (
                        <p className="text-sm text-destructive">
                          {memberErrors.familyGroup.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Participation toggles */}
                <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
                  <Controller
                    name={`memberStructure.${index}.participatesInFinances`}
                    control={control}
                    render={({ field: switchField }) => (
                      <div className="flex items-center gap-2.5">
                        <Switch
                          id={`member-${index}-finances`}
                          checked={switchField.value}
                          onCheckedChange={switchField.onChange}
                          disabled={isChild}
                        />
                        <Label
                          htmlFor={`member-${index}-finances`}
                          className={cn(
                            'text-sm font-normal',
                            isChild && 'text-muted-foreground'
                          )}
                        >
                          Participates in finances
                        </Label>
                      </div>
                    )}
                  />

                  <Controller
                    name={`memberStructure.${index}.participatesInTasks`}
                    control={control}
                    render={({ field: switchField }) => (
                      <div className="flex items-center gap-2.5">
                        <Switch
                          id={`member-${index}-tasks`}
                          checked={switchField.value}
                          onCheckedChange={switchField.onChange}
                        />
                        <Label
                          htmlFor={`member-${index}-tasks`}
                          className="text-sm font-normal"
                        >
                          Participates in tasks
                        </Label>
                      </div>
                    )}
                  />
                </div>

                {isChild && (
                  <p className="text-xs text-muted-foreground">
                    Children cannot participate in finances
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Array-level error */}
      {errors.memberStructure?.message && (
        <p className="text-sm text-destructive">
          {errors.memberStructure.message}
        </p>
      )}

      <SurveyNavigation showBack onBack={prevStep} />
    </form>
  );
}