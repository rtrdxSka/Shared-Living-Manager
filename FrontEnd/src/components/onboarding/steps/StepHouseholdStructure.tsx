import { useEffect } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Users } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
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
    email: '',
    ...(arrangement === 'multi_family' ? { familyGroup: '' } : {}),
  };
}

// ── Component ─────────────────────────────────────────────────────────

export function StepHouseholdStructure() {
  const { user } = useAuth();
  const { surveyState, updateStepData, nextStep, prevStep } = useOnboarding();

  const arrangement = surveyState.step1.livingArrangement;
  const totalMembers = surveyState.step1.totalMembers;
  const expectedCount = totalMembers - 1;
  const isAlone = arrangement === 'alone';
  const isMultiFamily = arrangement === 'multi_family';

  const schema = createStepHouseholdStructureSchema(arrangement, totalMembers, user?.email);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<StepHouseholdStructureData>({
    resolver: zodResolver(schema),
    defaultValues: {
      creatorProfile: {
        nickname: surveyState.step2.creatorProfile.nickname || '',
        ageGroup: surveyState.step2.creatorProfile.ageGroup || 'adult',
        participatesInFinances:
          surveyState.step2.creatorProfile.participatesInFinances ?? true,
        participatesInTasks:
          surveyState.step2.creatorProfile.participatesInTasks ?? true,
        ...(isMultiFamily
          ? { familyGroup: surveyState.step2.creatorProfile.familyGroup || '' }
          : {}),
      },
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

  const members = useWatch({ control, name: 'memberStructure' });

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
    updateStepData('step2', {
      creatorProfile: data.creatorProfile,
      memberStructure: data.memberStructure,
    });
    nextStep();
  };

  // Filter relationship options per arrangement
  const defaultRelationships = getDefaultRelationships(arrangement);
  const relationshipOptions = RELATIONSHIP_OPTIONS.filter(
    (opt) =>
      defaultRelationships.includes(opt.value) || opt.value === 'other'
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Creator profile ────────────────────────────────────────── */}
      <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-ink">Your profile</p>
        </div>

        <div className="space-y-4">
          {/* Nickname */}
          <div className="space-y-2">
            <Label htmlFor="creator-nickname">Nickname</Label>
            <Input
              id="creator-nickname"
              placeholder="How should others see you?"
              className={cn(
                errors.creatorProfile?.nickname && 'border-neg'
              )}
              {...register('creatorProfile.nickname')}
            />
            {errors.creatorProfile?.nickname && (
              <p className="text-sm text-neg">
                {errors.creatorProfile.nickname.message}
              </p>
            )}
          </div>

          {/* Age group + Family group row */}
          <div
            className={cn(
              'grid grid-cols-1 gap-4',
              isMultiFamily && 'sm:grid-cols-2'
            )}
          >
            <div className="space-y-2">
              <Label htmlFor="creator-ageGroup">Age group</Label>
              <Controller
                name="creatorProfile.ageGroup"
                control={control}
                render={({ field }) => (
                  <select
                    id="creator-ageGroup"
                    className={cn(
                      'flex h-11 w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20',
                      errors.creatorProfile?.ageGroup && 'border-neg'
                    )}
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {AGE_GROUP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.creatorProfile?.ageGroup && (
                <p className="text-sm text-neg">
                  {errors.creatorProfile.ageGroup.message}
                </p>
              )}
            </div>

            {isMultiFamily && (
              <div className="space-y-2">
                <Label htmlFor="creator-familyGroup">Family group</Label>
                <Input
                  id="creator-familyGroup"
                  placeholder="e.g. Family A"
                  className={cn(
                    errors.creatorProfile?.familyGroup && 'border-neg'
                  )}
                  {...register('creatorProfile.familyGroup')}
                />
                {errors.creatorProfile?.familyGroup && (
                  <p className="text-sm text-neg">
                    {errors.creatorProfile.familyGroup.message}
                  </p>
                )}
              </div>
            )}
          </div>
          {/* Participation toggles */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
            <Controller
              name="creatorProfile.participatesInFinances"
              control={control}
              render={({ field: switchField }) => (
                <div className="flex items-center gap-2.5">
                  <Switch
                    id="creator-finances"
                    checked={switchField.value}
                    onCheckedChange={switchField.onChange}
                  />
                  <Label
                    htmlFor="creator-finances"
                    className="text-sm font-normal"
                  >
                    Participates in finances
                  </Label>
                </div>
              )}
            />

            <Controller
              name="creatorProfile.participatesInTasks"
              control={control}
              render={({ field: switchField }) => (
                <div className="flex items-center gap-2.5">
                  <Switch
                    id="creator-tasks"
                    checked={switchField.value}
                    onCheckedChange={switchField.onChange}
                  />
                  <Label
                    htmlFor="creator-tasks"
                    className="text-sm font-normal"
                  >
                    Participates in tasks
                  </Label>
                </div>
              )}
            />
          </div>
        </div>
      </div>

      {/* ── Other members ──────────────────────────────────────────── */}
      {!isAlone && (
        <>
          <div className="flex items-start gap-3 rounded-xl bg-surface-2 border border-line p-4">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" />
            <p className="text-sm leading-relaxed text-ink-3">
              Now describe the{' '}
              <span className="font-medium text-ink">
                {expectedCount} other{' '}
                {expectedCount === 1 ? 'person' : 'people'}
              </span>{' '}
              in your household.
            </p>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => {
              const memberErrors = errors.memberStructure?.[index];
              const isChild = members[index]?.ageGroup === 'child';

              return (
                <div
                  key={field.id}
                  className="rounded-xl border border-line bg-surface p-4 sm:p-5"
                >
                  <p className="mb-4 text-sm font-semibold text-ink">
                    Member {index + 1}
                  </p>

                  <div className="space-y-4">
                    {/* Row 1: Nickname + Relationship */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`member-${index}-nickname`}>
                          Nickname
                        </Label>
                        <Input
                          id={`member-${index}-nickname`}
                          placeholder="e.g. Ivan"
                          className={cn(
                            memberErrors?.nickname && 'border-neg'
                          )}
                          {...register(`memberStructure.${index}.nickname`)}
                        />
                        {memberErrors?.nickname && (
                          <p className="text-sm text-neg">
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
                                'flex h-11 w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20',
                                memberErrors?.relationship &&
                                  'border-neg'
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
                          <p className="text-sm text-neg">
                            {memberErrors.relationship.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor={`member-${index}-email`}>Email</Label>
                      <Input
                        id={`member-${index}-email`}
                        type="email"
                        placeholder="e.g. member@example.com"
                        className={cn(
                          memberErrors?.email && 'border-neg'
                        )}
                        {...register(`memberStructure.${index}.email`)}
                      />
                      {memberErrors?.email && (
                        <p className="text-sm text-neg">
                          {memberErrors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Row 2: Age Group + Family Group */}
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
                                'flex h-11 w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20',
                                memberErrors?.ageGroup && 'border-neg'
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
                          <p className="text-sm text-neg">
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
                              memberErrors?.familyGroup && 'border-neg'
                            )}
                            {...register(
                              `memberStructure.${index}.familyGroup`
                            )}
                          />
                          {memberErrors?.familyGroup && (
                            <p className="text-sm text-neg">
                              {memberErrors.familyGroup.message}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Row 3: Participation toggles */}
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

          {errors.memberStructure?.message && (
            <p className="text-sm text-neg">
              {errors.memberStructure.message}
            </p>
          )}
        </>
      )}

      <SurveyNavigation showBack onBack={prevStep} />
    </form>
  );
}