'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import api, { unwrapApiResponse } from '@/lib/api';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { Skeleton } from '@/components/ui/Skeleton';
import { StreakWidget } from '@/components/ui/StreakWidget';
import { TokenBalanceWidget } from '@/components/dashboard/TokenBalanceWidget';
import { CheckCircle2 } from 'lucide-react';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { useTranslations } from 'next-intl';

interface UserData {
  id: string;
  username: string;
  email: string;
  currentStreak?: number;
  longestStreak?: number;
}

interface ProgressRecord {
  id: string;
  courseId: string;
  progressPct: number;
}

interface CredentialRecord {
  id: string;
  courseId: string;
  issuedAt: string;
  createdAt?: string;
  courseName?: string;
  course?: { id: string; title: string };
}

interface CourseData {
  id: string;
  title: string;
}

interface EnrollmentRecord {
  id: string;
  courseId: string;
  completedAt?: string | null;
  course?: CourseData;
}

interface BundleEnrollment {
  id: string;
  completedAt?: string | null;
  bundle?: { title?: string; courses?: unknown[] };
}

interface LearningPathEnrollment {
  id: string;
  completedAt?: string | null;
  learningPath?: { title?: string; courses?: unknown[] };
}

interface RecommendedCourse extends CourseData {
  level?: string;
  skills?: string[];
  matchReasons?: string[];
  averageRating?: number | string | null;
}

interface LessonProgressRecord {
  id: string;
  courseId: string;
  lessonId: string;
  progressPct: number;
  completedAt: string | null;
}

export default function DashboardPage() {
  const { state } = useAuth();
  const t = useTranslations('dashboard');
  const [user, setUser] = useState<UserData | null>(
    state.user
      ? {
          id: state.user.id,
          username: state.user.username,
          email: state.user.email,
          currentStreak:
            'currentStreak' in state.user && typeof state.user.currentStreak === 'number'
              ? state.user.currentStreak
              : undefined,
          longestStreak:
            'longestStreak' in state.user && typeof state.user.longestStreak === 'number'
              ? state.user.longestStreak
              : undefined,
        }
      : null
  );
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [courses, setCourses] = useState<Record<string, CourseData>>({});
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [bundleEnrollments, setBundleEnrollments] = useState<BundleEnrollment[]>([]);
  const [pathEnrollments, setPathEnrollments] = useState<LearningPathEnrollment[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        if (!state.token && !state.isLoading) {
          // ProtectedRoute will handle redirect; do not fetch yet.
          return;
        }

        let currentUser = user;
        if (!currentUser) {
          const { data: responseData } = await api.get('/users/me');
          const data = unwrapApiResponse<UserData>(responseData);
          currentUser = {
            id: data.id,
            username: data.username,
            email: data.email,
            currentStreak: data.currentStreak,
            longestStreak: data.longestStreak,
          };
          setUser(currentUser);
        }

        if (!currentUser?.id) {
          throw new Error('User information is missing.');
        }

        const [enrollmentsRes, progressRes, credRes] = await Promise.all([
          api.get(`/users/${currentUser.id}/enrollments`),
          api.get(`/users/${currentUser.id}/progress`),
          api.get(`/credentials/${currentUser.id}`),
        ]);

        const enrollmentRecords = unwrapApiResponse<EnrollmentRecord[]>(enrollmentsRes.data) ?? [];
        setEnrollments(enrollmentRecords);
        void Promise.allSettled([
          api.get('/bundles/user/me'),
          api.get('/learning-paths/user/me'),
          api.get('/v1/recommendations?limit=5'),
        ]).then(([bundlesRes, pathsRes, recsRes]) => {
          if (bundlesRes.status === 'fulfilled') {
            setBundleEnrollments(
              unwrapApiResponse<BundleEnrollment[]>(bundlesRes.value.data) ?? []
            );
          }
          if (pathsRes.status === 'fulfilled') {
            setPathEnrollments(
              unwrapApiResponse<LearningPathEnrollment[]>(pathsRes.value.data) ?? []
            );
          }
          if (recsRes.status === 'fulfilled') {
            setRecommendations(unwrapApiResponse<RecommendedCourse[]>(recsRes.value.data) ?? []);
          }
        });

        const progressRecords: ProgressRecord[] = (
          unwrapApiResponse<LessonProgressRecord[]>(progressRes.data) ?? []
        ).map(({ id, courseId, progressPct }) => ({ id, courseId, progressPct: progressPct ?? 0 }));

        setProgress(progressRecords);

        const credentialsList: CredentialRecord[] = (
          unwrapApiResponse<CredentialRecord[]>(credRes.data) ?? []
        ).map((c) => ({
          id: c.id,
          courseId: c.courseId,
          issuedAt: c.issuedAt ?? c.createdAt ?? '',
          courseName: c.courseName,
          course: c.course ? { id: c.course.id, title: c.course.title } : undefined,
        }));

        setCredentials(
          credentialsList.sort(
            (a, b) => Number(new Date(b.issuedAt)) - Number(new Date(a.issuedAt))
          )
        );

        const courseMap: Record<string, CourseData> = {};
        enrollmentRecords.forEach((enrollment) => {
          if (enrollment.course) {
            courseMap[enrollment.courseId] = enrollment.course;
          }
        });
        const courseIds = enrollmentRecords
          .filter((enrollment) => !courseMap[enrollment.courseId])
          .map((enrollment) => enrollment.courseId);

        await Promise.all(
          courseIds.map(async (courseId) => {
            try {
              const { data } = await api.get(`/courses/${courseId}`);
              const course = unwrapApiResponse<CourseData>(data);
              if (course) {
                courseMap[course.id] = { id: course.id, title: course.title };
              }
            } catch {
              // ignore missing course details
            }
          })
        );

        setCourses(courseMap);
      } catch (err) {
        setError('Unable to load dashboard information. Please refresh.');
      } finally {
        setIsLoading(false);
      }
    }

    if (!state.isLoading) loadDashboard();
  }, [state.isLoading, state.token, user]);

  const enrolledCourses = useMemo(() => {
    const progressByCourse = new Map(
      progress.map((record) => [record.courseId, record.progressPct])
    );
    return enrollments.map((enrollment) => ({
      id: enrollment.id,
      courseId: enrollment.courseId,
      progressPct: progressByCourse.get(enrollment.courseId) ?? 0,
      title:
        courses[enrollment.courseId]?.title ?? t('courseFallback', { id: enrollment.courseId }),
    }));
  }, [progress, enrollments, courses, t]);

  const recentCredentials = useMemo(() => {
    return credentials.slice(0, 5);
  }, [credentials]);

  return (
    <ProtectedRoute>
      <OnboardingWizard />
      <main className="max-w-5xl mx-auto p-8 space-y-8">
        <section>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="w-48 h-8" />
              <Skeleton className="w-64 h-5" />
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {t('welcome', { name: user?.username ?? user?.email ?? t('student') })}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-700 dark:bg-red-900/20">
            {t('loadError')}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('learningStreak')}
            </h2>
            <StreakWidget
              currentStreak={user?.currentStreak ?? 0}
              longestStreak={user?.longestStreak ?? 0}
              isLoading={isLoading}
            />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('tokenBalance')}
            </h2>
            <TokenBalanceWidget stellarPublicKey={state.user?.stellarPublicKey} />
          </div>
        </section>

        {bundleEnrollments.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {t('activeBundles')}
            </h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {bundleEnrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10"
                >
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {enrollment.bundle.title}
                  </h3>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {t('coursesCount', { count: enrollment.bundle.courses.length })}
                    </span>
                    {enrollment.completedAt ? (
                      <span className="text-green-600 font-bold flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> {t('completed')}
                      </span>
                    ) : (
                      <span className="text-blue-600 font-bold">{t('inProgress')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {pathEnrollments.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {t('learningPaths')}
            </h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {pathEnrollments.map((enrollment) => {
                const lp = enrollment.learningPath;
                const total = lp?.courses?.length ?? 0;
                return (
                  <div
                    key={enrollment.id}
                    className="p-4 rounded-lg border border-purple-100 dark:border-purple-900/30 bg-purple-50/30 dark:bg-purple-900/10"
                  >
                    <h3 className="font-bold text-gray-900 dark:text-white">{lp?.title}</h3>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-gray-500">{t('coursesCount', { count: total })}</span>
                      {enrollment.completedAt ? (
                        <span className="text-green-600 font-bold flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-1" /> {t('completed')}
                        </span>
                      ) : (
                        <span className="text-purple-600 font-bold">{t('inProgress')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {recommendations.length > 0 && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {t('recommended')}
              </h2>
              <Link
                href="/recommendations"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {t('viewAll')} →
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white">{course.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="capitalize px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                      {course.level}
                    </span>
                    {course.skills?.slice(0, 2).map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                        {s}
                      </span>
                    ))}
                  </div>
                  {course.matchReasons?.length > 0 && (
                    <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                      {course.matchReasons[0]}
                    </p>
                  )}
                  {course.averageRating != null && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      ★ {Number(course.averageRating).toFixed(1)}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t('enrolledCourses')}
          </h2>
          <div className="mt-3 space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="space-y-2">
                  <Skeleton className="w-2/5 h-5" />
                  <Skeleton className="w-full h-3" />
                </div>
              ))
            ) : enrolledCourses.length === 0 ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">{t('emptyEnrollments')}</p>
                <Link
                  href="/courses"
                  className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {t('browseCourses')}
                </Link>
              </div>
            ) : (
              enrolledCourses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-4"
                >
                  <CircularProgress value={course.progressPct} size={72} strokeWidth={7} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                      {course.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {course.progressPct === 100
                        ? t('completed')
                        : t('progressComplete', { percent: course.progressPct })}
                    </p>
                    <div
                      className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700"
                      role="progressbar"
                      aria-label={t('progressForCourse', { title: course.title })}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, Math.max(0, course.progressPct))}
                    >
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, course.progressPct))}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="flex items-center gap-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t('recentCredentials')}
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {credentials.length}
              <span className="sr-only"> {t('credentialCountLabel')}</span>
            </span>
          </h2>
          <div className="mt-3 space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton key={idx} className="w-full h-6" />
              ))
            ) : recentCredentials.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">{t('emptyCredentials')}</p>
            ) : (
              recentCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300"
                >
                  <span>
                    {cred.course?.title ??
                      cred.courseName ??
                      t('courseFallback', { id: cred.courseId })}
                  </span>
                  <span>{new Date(cred.issuedAt).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </ProtectedRoute>
  );
}
