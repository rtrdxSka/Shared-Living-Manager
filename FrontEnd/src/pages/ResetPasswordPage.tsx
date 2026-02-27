import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle, KeyRound, CheckCircle2, XCircle } from 'lucide-react';
import axios from 'axios';

import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '@/schemas/auth.schemas';
import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormField } from '@/contexts/FormField';
import type { ApiErrorResponse } from '@/types/auth.types';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [serverError, setServerError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;
    setServerError('');

    try {
      await authApi.resetPassword(token, data.password);
      setIsSuccess(true);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiErrorResponse | undefined;
        setServerError(apiError?.message || 'Password reset failed. Please try again.');
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

  // No token in URL
  if (!token) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:py-12">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
        <Card className="relative w-full max-w-md rounded-2xl border-border/60 shadow-xl">
          <CardHeader className="space-y-4 pb-2 pt-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive shadow-sm">
              <XCircle className="h-7 w-7 text-destructive-foreground" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
                Invalid Link
              </CardTitle>
              <CardDescription className="text-base">
                This password reset link is invalid or has expired.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 px-6 pb-8 sm:px-8">
            <Button asChild className="h-11 w-full rounded-xl text-base shadow-sm">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:py-12">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
      <Card className="relative w-full max-w-md rounded-2xl border-border/60 shadow-xl">
        <CardHeader className="space-y-4 pb-2 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-sm">
            <KeyRound className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
              {isSuccess ? 'Password reset' : 'Set new password'}
            </CardTitle>
            <CardDescription className="text-base">
              {isSuccess
                ? 'Your password has been reset successfully.'
                : 'Enter your new password below'}
            </CardDescription>
          </div>
        </CardHeader>

        {isSuccess ? (
          <CardContent className="flex flex-col items-center gap-6 px-6 pb-8 sm:px-8">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <Button asChild className="h-11 w-full rounded-xl text-base shadow-sm">
              <Link to="/login">Login with new password</Link>
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-5 px-6 sm:px-8">
              {serverError && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              <FormField
                label="New Password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                error={errors.password}
                {...register('password')}
              />

              <FormField
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                error={errors.confirmPassword}
                {...register('confirmPassword')}
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-6 px-6 pb-8 pt-2 sm:px-8">
              <Button type="submit" className="h-11 w-full rounded-xl text-base shadow-sm" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset password'
                )}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
