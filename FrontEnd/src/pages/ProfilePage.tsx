import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertCircle, CheckCircle2, AlertTriangle, User } from 'lucide-react';
import axios from 'axios';

import { profileSchema, type ProfileFormData } from '@/schemas/user.schemas';
import { changePasswordSchema, type ChangePasswordFormData } from '@/schemas/user.schemas';
import { userApi } from '@/api/user.api';
import { authApi } from '@/api/auth.api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormField } from '@/contexts/FormField';
import type { ApiErrorResponse } from '@/types/auth.types';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* Email verification banner */}
      {!user.isEmailVerified && <VerificationBanner />}

      <div className="space-y-8">
        <ProfileForm user={{ ...user, isEmailVerified: user.isEmailVerified }} refreshUser={refreshUser} />
        <ChangePasswordForm />
      </div>
    </div>
  );
}

// ── Verification Banner ──────────────────────────────────────────────

function VerificationBanner() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleResend = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      await authApi.resendVerification();
      setMessage('Verification email sent. Please check your inbox.');
    } catch {
      setMessage('Failed to send verification email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Alert className="mb-8 rounded-xl border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4 !text-amber-600 dark:!text-amber-400" />
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>Your email address is not verified.</span>
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setServerError('');
    setSuccessMessage('');

    try {
      const updatedUser = await userApi.updateProfile(data);
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
    <Card className="rounded-2xl border-border/60 shadow-xl">
      <CardHeader className="space-y-2 pb-2 pt-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-sm">
          <User className="h-7 w-7 text-primary-foreground" />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">Profile</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5 px-6 sm:px-8">
          {serverError && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="rounded-xl border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4 !text-green-600 dark:!text-green-400" />
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
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
          </div>

          <FormField
            label="Email"
            type="email"
            placeholder="ivan@example.com"
            autoComplete="email"
            error={errors.email}
            {...register('email')}
          />

          {user.isEmailVerified ? (
            <div className="flex items-center gap-1.5 -mt-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-700 dark:text-green-400">Email verified</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 -mt-3">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-xs text-amber-700 dark:text-amber-400">Email not verified</span>
            </div>
          )}

          <Button type="submit" className="h-11 w-full rounded-xl text-base shadow-sm" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}

// ── Change Password Form ─────────────────────────────────────────────

function ChangePasswordForm() {
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
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
    setSuccessMessage('');

    try {
      await userApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setSuccessMessage('Password changed successfully.');
      reset();
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
    <Card className="rounded-2xl border-border/60 shadow-xl">
      <CardHeader className="space-y-2 pb-2 pt-8 text-center">
        <CardTitle className="text-xl font-bold tracking-tight">Change Password</CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5 px-6 sm:px-8">
          {serverError && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="rounded-xl border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4 !text-green-600 dark:!text-green-400" />
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

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

          <Button type="submit" className="h-11 w-full rounded-xl text-base shadow-sm" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing...
              </>
            ) : (
              'Change password'
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
