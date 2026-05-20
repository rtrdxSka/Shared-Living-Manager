import { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { extractApiError } from '@/utils/extractApiError';

import { createProfileSchema, type ProfileFormData } from '@/schemas/user.schemas';
import { changePasswordSchema, type ChangePasswordFormData } from '@/schemas/user.schemas';
import { userApi } from '@/api/user.api';
import { authApi } from '@/api/auth.api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '@/contexts/FormField';
import type { ApiErrorResponse } from '@/types/auth.types';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const wasRedirected = location.state?.emailVerificationRequired === true;

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      {/* Email verification banner */}
      {!user.isEmailVerified && <VerificationBanner wasRedirected={wasRedirected} />}

      {/* Page header */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Profile</h1>
        <p className="text-sm text-ink-3 mt-1">Your personal account settings</p>
      </header>

      {/* Avatar block */}
      <Card className="p-6">
        <div className="flex items-center gap-5">
          <Avatar
            name={`${user.firstName} ${user.lastName}`}
            size={72}
            variant="filled"
            className="rounded-3xl"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-ink-3 truncate">{user.email}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" disabled>Change</Button>
            <Button variant="ghost" size="sm" disabled>Remove</Button>
          </div>
        </div>
      </Card>

      {/* Profile information */}
      <ProfileForm user={{ ...user, isEmailVerified: user.isEmailVerified }} refreshUser={refreshUser} />

      {/* Change password */}
      <ChangePasswordForm />

      {/* Notifications */}
      <Card className="p-6">
        <EyebrowLabel as="div" className="mb-4">NOTIFICATIONS</EyebrowLabel>
        <div className="space-y-1 divide-y divide-line">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-ink">Email notifications</p>
              <p className="text-xs text-ink-3 mt-0.5">Receive updates and alerts via email</p>
            </div>
            {/* Read-only display — not wired to a mutation */}
            <span className="text-xs text-ink-3">
              {user.preferences.notifications.email ? 'On' : 'Off'}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-ink">Push notifications</p>
              <p className="text-xs text-ink-3 mt-0.5">Receive real-time push alerts</p>
            </div>
            <span className="text-xs text-ink-3">
              {user.preferences.notifications.push ? 'On' : 'Off'}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-ink">Frequency</p>
              <p className="text-xs text-ink-3 mt-0.5">How often you receive digest emails</p>
            </div>
            <span className="text-xs text-ink-3 capitalize">
              {user.preferences.notifications.frequency}
            </span>
          </div>
        </div>
      </Card>

      {/* Danger zone */}
      <DangerZone />
    </div>
  );
}

// ── Verification Banner ──────────────────────────────────────────────

function VerificationBanner({ wasRedirected }: { wasRedirected: boolean }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleResend = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      await authApi.resendVerification();
      setMessage('Verification email sent. Please check your inbox.');
    } catch (error) {
      setMessage(extractApiError(error, 'Failed to send verification email. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Alert className="rounded-xl border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4 !text-amber-600 dark:!text-amber-400" />
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {wasRedirected
            ? 'Please verify your email address to access the dashboard and other features.'
            : 'Your email address is not verified.'}
        </span>
        <div className="flex items-center gap-2">
          {message && (
            <span className="text-xs">{message}</span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 rounded-lg border-amber-500/50 text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-950/50"
            onClick={() => void handleResend()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            Resend verification email
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

// ── Profile Form ─────────────────────────────────────────────────────

function ProfileForm({
  user,
  refreshUser,
}: {
  user: { firstName: string; lastName: string; email: string; isEmailVerified: boolean };
  refreshUser: () => Promise<void>;
}) {
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const schema = useMemo(() => createProfileSchema(user.email), [user.email]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      currentPassword: '',
    },
  });

  const watchedEmail = useWatch({ control, name: 'email' });
  const isEmailChanging = watchedEmail !== user.email;

  const onSubmit = async (data: ProfileFormData) => {
    setServerError('');
    setSuccessMessage('');

    try {
      // Only send currentPassword when email is actually changing
      const payload: ProfileFormData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      };
      if (isEmailChanging && data.currentPassword) {
        payload.currentPassword = data.currentPassword;
      }

      const updatedUser = await userApi.updateProfile(payload);
      await refreshUser();

      if (updatedUser.email !== user.email) {
        setSuccessMessage('Profile updated. A verification email has been sent to your new email address.');
      } else {
        setSuccessMessage('Profile updated successfully.');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiErrorResponse | undefined;
        setServerError(apiError?.message || 'Failed to update profile. Please try again.');
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <Card className="p-6">
      <EyebrowLabel as="div" className="mb-4">PROFILE INFORMATION</EyebrowLabel>

      {serverError && (
        <Alert variant="destructive" className="rounded-xl mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="rounded-xl border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200 mb-4">
          <CheckCircle2 className="h-4 w-4 !text-green-600 dark:!text-green-400" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="First Name"
            type="text"
            placeholder="Ivan"
            autoComplete="given-name"
            error={errors.firstName}
            {...register('firstName')}
          />
          <FormField
            label="Last Name"
            type="text"
            placeholder="Smith"
            autoComplete="family-name"
            error={errors.lastName}
            {...register('lastName')}
          />

          <div className="sm:col-span-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ivan@example.com"
                autoComplete="email"
                className={errors.email ? 'border-destructive' : ''}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
              <div className="flex items-center gap-1.5">
                {user.isEmailVerified ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-green-700 dark:text-green-400">Email verified</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-amber-700 dark:text-amber-400">Email not verified</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {isEmailChanging && (
            <div className="sm:col-span-2">
              <FormField
                label="Current Password"
                type="password"
                placeholder="Required to change email"
                autoComplete="current-password"
                error={errors.currentPassword}
                {...register('currentPassword')}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── Change Password Form ─────────────────────────────────────────────

function ChangePasswordForm() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setServerError('');

    try {
      await userApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      // Backend invalidates refresh token on password change — log out proactively
      await logout();
      navigate('/login', {
        replace: true,
        state: { message: 'Password changed successfully. Please log in with your new password.' },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiErrorResponse | undefined;
        setServerError(apiError?.message || 'Failed to change password. Please try again.');
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <Card className="p-6">
      <EyebrowLabel as="div" className="mb-4">CHANGE PASSWORD</EyebrowLabel>

      {serverError && (
        <Alert variant="destructive" className="rounded-xl mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <FormField
            label="Current Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.currentPassword}
            {...register('currentPassword')}
          />
          <FormField
            label="New Password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.newPassword}
            {...register('newPassword')}
          />
          <FormField
            label="Confirm New Password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.confirmNewPassword}
            {...register('confirmNewPassword')}
          />
        </div>

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing...
              </>
            ) : (
              'Change password'
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── Danger Zone ──────────────────────────────────────────────────────
// Leave household and delete account are not yet wired to API endpoints.
// Buttons are rendered as visible stubs (disabled) consistent with the design spec.

function DangerZone() {
  return (
    <Card className="p-6 border-neg/30">
      <EyebrowLabel as="div" className="mb-4 text-neg">DANGER ZONE</EyebrowLabel>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Leave household</p>
            <p className="text-xs text-ink-3 mt-0.5">Removes you from your current household.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-neg/40 text-neg hover:bg-neg/5 hover:text-neg shrink-0"
            disabled
          >
            Leave
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Delete account</p>
            <p className="text-xs text-ink-3 mt-0.5">Permanently delete your account and all data.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-neg/40 text-neg hover:bg-neg/5 hover:text-neg shrink-0"
            disabled
          >
            Delete account
          </Button>
        </div>
      </div>
    </Card>
  );
}
