'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { ButtonSpinner } from '@/components/ui/Spinner';

interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  mfa_required?: boolean;
}

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [awaitingMfa, setAwaitingMfa] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);
  const [mfaToken, setMfaToken] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, touchedFields },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    // Validate on change AND blur — errors appear as soon as the user types
    mode: 'onChange',
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setApiError(null);

    try {
      if (!awaitingMfa) {
        const res = await api.post<LoginResponse>('/auth/login', {
          email: data.email,
          password: data.password,
        });

        if (res.data.mfa_required) {
          setAwaitingMfa(true);
          setPendingCredentials({ email: data.email, password: data.password });
          setIsLoading(false);
          return;
        }

        if (!res.data.access_token) {
          throw new Error('Unexpected response from server');
        }

        localStorage.setItem('access_token', res.data.access_token);
        const profileResponse = await api.get('/users/me');
        login(res.data.access_token, profileResponse.data);
        setIsLoading(false);
        router.push('/dashboard');
        return;
      }

      if (!pendingCredentials) {
        throw new Error('Please retry login from the beginning.');
      }

      const res = await api.post<LoginResponse>('/auth/login', {
        email: pendingCredentials.email,
        password: pendingCredentials.password,
        mfa_token: mfaToken,
      });

      if (!res.data.access_token) {
        throw new Error('Invalid MFA token');
      }

      localStorage.setItem('access_token', res.data.access_token);
      const profileResponse = await api.get('/users/me');
      login(res.data.access_token, profileResponse.data);
      setIsLoading(false);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err instanceof Error ? err.message : 'Invalid credentials');
      setApiError(typeof message === 'string' ? message : 'Invalid credentials');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow p-8 flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in</h1>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            success={!errors.email && touchedFields.email ? 'Looks good!' : undefined}
            required
            {...register('email')}
          />

          <FormField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            required
            disabled={awaitingMfa}
            {...register('password')}
          />

          {awaitingMfa && (
            <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
              <p className="font-medium">Two-factor authentication required</p>
              <p>Enter the code from your authenticator app or a backup recovery code to continue.</p>
              <FormField
                label="MFA Code"
                type="text"
                value={mfaToken}
                onChange={(e) => setMfaToken((e.target as HTMLInputElement).value.trim())}
                placeholder="123456"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => {
                  setAwaitingMfa(false);
                  setPendingCredentials(null);
                  setMfaToken('');
                }}
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Change login details
              </button>
            </div>
          )}

          {/* API-level error (wrong credentials, server error, etc.) */}
          {apiError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {apiError}
            </p>
          )}

          <div className="text-right -mt-2">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Forgot password?
            </Link>
          </div>

          {/*
            Disabled conditions:
              1. isLoading — network request in flight
              2. !isValid  — zod schema fails (email invalid, password empty)
            For MFA step we skip isValid check since the extra mfaToken field
            isn't part of the react-hook-form schema.
          */}
          <Button
            type="submit"
            disabled={isLoading || (!awaitingMfa && !isValid)}
            className="w-full mt-2"
            aria-describedby={apiError ? 'login-api-error' : undefined}
          >
            {isLoading ? (
              <>
                <ButtonSpinner />
                {awaitingMfa ? 'Verifying…' : 'Signing in…'}
              </>
            ) : (
              awaitingMfa ? 'Verify code' : 'Sign in'
            )}
          </Button>
        </form>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
        </div>

        <a
          href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/auth/google`}
          className="flex items-center justify-center gap-3 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          aria-label="Continue with Google"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58Z"/>
          </svg>
          Continue with Google
        </a>

        <p className="text-sm text-center text-gray-600 dark:text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="text-blue-600 hover:underline dark:text-blue-400">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
