import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2, Home } from 'lucide-react';
import axios from 'axios';


import { loginSchema, type LoginFormData } from '@/schemas/auth.schemas';
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

import type { ApiErrorResponse } from '@/types/auth.types';
import { FormField } from '@/contexts/FormField';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');

  const locationMessage = (location.state as { message?: string } | null)?.message;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError('');

    try {
      await login(data);
      navigate('/', { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiErrorResponse | undefined;
        setServerError(
          apiError?.message || 'An error occurred during login. Please try again.'
        );
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
            <Home className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</CardTitle>
            <CardDescription className="text-base">
              Enter your credentials to continue
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-5 px-6 sm:px-8">
            {locationMessage && (
              <Alert className="rounded-xl border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200">
                <CheckCircle2 className="h-4 w-4 !text-green-600 dark:!text-green-400" />
                <AlertDescription>{locationMessage}</AlertDescription>
              </Alert>
            )}

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

            <div className="space-y-2">
              <FormField
                label="Password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                error={errors.password}
                {...register('password')}
              />
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-6 px-6 pb-8 pt-2 sm:px-8">
            <Button type="submit" className="h-11 w-full rounded-xl text-base shadow-sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                Register
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}