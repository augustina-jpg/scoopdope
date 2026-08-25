/**
 * React Query hooks for the three main data domains:
 *  - useCertificates  — user's earned certificates (5 min stale, profile page)
 *  - useCourses       — paginated course list (5 min stale, course list page)
 *  - useProgress      — per-user progress records (1 min stale — changes often)
 *
 * Cache invalidation:
 *  - useCertificatesInvalidate — call after a course is completed / cert issued
 *  - useProgressInvalidate     — call after a lesson is marked complete
 *  - useCoursesInvalidate      — call after enrollment (enrollment affects course state)
 *
 * All hooks are client-side only (they call the api axios instance which reads
 * the JWT from the auth store).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Certificate } from '@/components/profile/CertificatesSection';

// ── Query keys ─────────────────────────────────────────────────────────────────
// Organised as tuples so we can do fine-grained partial invalidation.

export const queryKeys = {
  certificates: (userId: string) => ['certificates', userId] as const,
  courses: (params?: Record<string, string>) => ['courses', params ?? {}] as const,
  progress: (userId: string) => ['progress', userId] as const,
  courseDetail: (courseId: string) => ['course', courseId] as const,
} as const;

// ── Certificates ──────────────────────────────────────────────────────────────

/**
 * Fetches all certificates earned by a user.
 *
 * GET /v1/users/:userId/certificates
 *
 * staleTime: 5 min — certificates don't change frequently;
 * they are invalidated explicitly after a course is completed.
 */
export function useCertificates(userId: string | null | undefined) {
  return useQuery<Certificate[]>({
    queryKey: queryKeys.certificates(userId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<Certificate[]>(`/users/${userId}/certificates`);
      return data;
    },
    // Don't run if we don't have a userId yet (loading state / unauthenticated)
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Returns an invalidator for the certificates cache — call after cert issuance */
export function useCertificatesInvalidate() {
  const queryClient = useQueryClient();
  return (userId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.certificates(userId) });
}

// ── Courses ───────────────────────────────────────────────────────────────────

interface CoursesParams {
  search?: string;
  level?: string;
  language?: string;
  category?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

interface CoursesResponse {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Fetches the courses list with optional filters.
 *
 * GET /v1/courses
 *
 * staleTime: 5 min — course catalogue is relatively stable.
 * Invalidate after enrolment to refresh "enrolled" state.
 */
export function useCourses(params: CoursesParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.search?.trim()) searchParams.set('search', params.search.trim());
  if (params.level) searchParams.set('level', params.level);
  if (params.language) searchParams.set('language', params.language);
  if (params.category) searchParams.set('category', params.category);
  if (params.sort) searchParams.set('sort', params.sort);
  searchParams.set('page', String(params.page ?? 1));
  searchParams.set('limit', String(params.limit ?? 9));

  const queryString = searchParams.toString();

  return useQuery<CoursesResponse>({
    queryKey: queryKeys.courses(Object.fromEntries(searchParams)),
    queryFn: async () => {
      const { data } = await api.get<CoursesResponse>(`/courses?${queryString}`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Invalidate the full courses cache (e.g. after enrolment) */
export function useCoursesInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['courses'] });
}

// ── Progress ──────────────────────────────────────────────────────────────────

interface ProgressRecord {
  courseId: string;
  lessonId: string;
  progressPct: number;
  completedAt: string | null;
}

/**
 * Fetches flat progress records for all of a user's in-progress courses.
 *
 * GET /v1/users/:userId/progress
 *
 * staleTime: 1 min — progress changes frequently as lessons are completed.
 * Invalidate after each lesson completion so the UI reflects the latest state.
 */
export function useProgress(userId: string | null | undefined) {
  return useQuery<ProgressRecord[]>({
    queryKey: queryKeys.progress(userId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<ProgressRecord[]>(`/users/${userId}/progress`);
      return data;
    },
    enabled: !!userId,
    // 1 minute — progress data is frequently updated
    staleTime: 60 * 1000,
  });
}

/** Invalidate progress cache — call after a lesson is marked complete */
export function useProgressInvalidate() {
  const queryClient = useQueryClient();
  return (userId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.progress(userId) });
}
