import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
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

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError('');

    try {
      await authApi.forgotPassword(data.email);
      setIsSubmitted(true);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiErrorResponse | undefined;
        setServerError(apiError?.message || 'An error occurred. Please try again.');
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

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
              {isSubmitted ? 'Check your email' : 'Forgot password'}
            </CardTitle>
            <CardDescription className="text-base">
              {isSubmitted
                ? 'If an account exists with that email, we sent a password reset link.'
                : 'Enter your email and we\'ll send you a reset link'}
            </CardDescription>
          </div>
        </CardHeader>

        {isSubmitted ? (
          <CardContent className="flex flex-col items-center gap-6 px-6 pb-8 sm:px-8">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="text-center text-sm text-muted-foreground">
              Please check your inbox and spam folder. The link expires in 1 hour.
            </p>
            <Button asChild variant="outline" className="h-11 w-full rounded-xl text-base">
              <Link to="/login">Back to Login</Link>
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
                label="Email"
                type="email"
                placeholder="ivan@example.com"
                autoComplete="email"
                error={errors.email}
                {...register('email')}
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-6 px-6 pb-8 pt-2 sm:px-8">
              <Button type="submit" className="h-11 w-full rounded-xl text-base shadow-sm" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Remember your password?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  Back to Login
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
