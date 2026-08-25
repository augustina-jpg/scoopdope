/**
 * Tests for React Query hooks: useCertificates, useCourses, useProgress.
 *
 * Uses MSW (Mock Service Worker) to intercept API requests and a real
 * QueryClient so we test the full hook behaviour including caching.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import {
  useCertificates,
  useCourses,
  useProgress,
  queryKeys,
} from '@/hooks/useQueryHooks';

// ── MSW server ────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const mockCertificates = [
  {
    id: 'cert-1',
    courseId: 'course-1',
    certificateHash: 'abc123',
    stellarTransactionId: 'tx-abc',
    status: 'minted' as const,
    issuedAt: '2026-03-15T10:00:00.000Z',
    revokedAt: null,
    course: { id: 'course-1', title: 'Intro to Stellar Blockchain' },
  },
];

const mockCourses = {
  data: [
    { id: '1', title: 'Intro to Stellar Blockchain', level: 'beginner' },
    { id: '2', title: 'Soroban Smart Contracts', level: 'intermediate' },
  ],
  total: 2,
  page: 1,
  limit: 9,
};

const mockProgress = [
  { courseId: 'course-1', lessonId: 'lesson-1', progressPct: 100, completedAt: '2026-03-10T09:00:00.000Z' },
  { courseId: 'course-2', lessonId: 'lesson-5', progressPct: 45, completedAt: null },
];

const server = setupServer(
  http.get(`${BASE}/users/user-1/certificates`, () =>
    HttpResponse.json(mockCertificates)
  ),
  http.get(`${BASE}/courses`, () =>
    HttpResponse.json(mockCourses)
  ),
  http.get(`${BASE}/users/user-1/progress`, () =>
    HttpResponse.json(mockProgress)
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Helper: fresh QueryClient + wrapper per test ──────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,       // fail fast in tests — no retries
        staleTime: 0,       // always treat data as stale so fetches happen
        gcTime: Infinity,   // keep data in cache for the duration of the test
      },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return { wrapper: Wrapper, queryClient };
}

// ── useCertificates ───────────────────────────────────────────────────────────

describe('useCertificates', () => {
  it('returns loading state initially', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCertificates('user-1'), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches and returns certificates for the given userId', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCertificates('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe('cert-1');
    expect(result.current.data![0].course?.title).toBe('Intro to Stellar Blockchain');
  });

  it('does not fetch when userId is null', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCertificates(null), { wrapper });

    // Query is disabled — should never be in loading or success state
    expect(result.current.isPending).toBe(true);
    expect(result.current.isFetching).toBe(false);
  });

  it('does not fetch when userId is undefined', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCertificates(undefined), { wrapper });

    expect(result.current.isFetching).toBe(false);
  });

  it('returns an error when the API fails', async () => {
    server.use(
      http.get(`${BASE}/users/user-1/certificates`, () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
      )
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCertificates('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('uses the correct query key', () => {
    expect(queryKeys.certificates('user-1')).toEqual(['certificates', 'user-1']);
  });
});

// ── useCourses ────────────────────────────────────────────────────────────────

describe('useCourses', () => {
  it('returns loading state initially', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCourses(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches and returns the courses list', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCourses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
  });

  it('includes first page course titles', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCourses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const titles = result.current.data?.data.map((c: { title: string }) => c.title);
    expect(titles).toContain('Intro to Stellar Blockchain');
    expect(titles).toContain('Soroban Smart Contracts');
  });

  it('returns an error when the API fails', async () => {
    server.use(
      http.get(`${BASE}/courses`, () =>
        HttpResponse.json({ message: 'Server Error' }, { status: 500 })
      )
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCourses(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('uses the correct base query key prefix', () => {
    const key = queryKeys.courses({ page: '1', limit: '9' });
    expect(key[0]).toBe('courses');
  });
});

// ── useProgress ───────────────────────────────────────────────────────────────

describe('useProgress', () => {
  it('returns loading state initially', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProgress('user-1'), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches and returns progress records', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProgress('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].progressPct).toBe(100);
    expect(result.current.data![1].progressPct).toBe(45);
  });

  it('does not fetch when userId is null', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProgress(null), { wrapper });

    expect(result.current.isFetching).toBe(false);
  });

  it('does not fetch when userId is undefined', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProgress(undefined), { wrapper });

    expect(result.current.isFetching).toBe(false);
  });

  it('returns an error when the API fails', async () => {
    server.use(
      http.get(`${BASE}/users/user-1/progress`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 })
      )
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProgress('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('uses the correct query key', () => {
    expect(queryKeys.progress('user-1')).toEqual(['progress', 'user-1']);
  });
});
