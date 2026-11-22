'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { ReviewList } from '@/components/reviews/ReviewList';
import { QAPanel } from '@/components/courses/QAPanel';
import { AnnouncementsPanel } from '@/components/courses/AnnouncementsPanel';
import { AssignmentsTab } from '@/components/assignments/AssignmentsTab';
import { CourseForumTab } from '@/components/forum/CourseForumTab';
import { WaitlistButton } from '@/components/courses/WaitlistButton';
import { PrerequisitesPanel } from '@/components/courses/PrerequisitesPanel';
import { ProgressTracker } from '@/components/courses/ProgressTracker';
import { useAuth } from '@/hooks/useAuth';
import { useCompareStore } from '@/store/compare.store';
import api, { unwrapApiResponse } from '@/lib/api';
import { reviewsApi } from '@/lib/reviewsApi';
import {
  PlayCircle,
  Lock,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Circle,
  AlertTriangle,
} from 'lucide-react';

interface CourseDetailPageProps {
  params: { id: string };
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  maxEnrollment: number | null;
  enrollmentCount?: number;
  isPublished: boolean;
}

interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
}

interface LessonProgressRecord {
  courseId: string;
  lessonId: string;
  progressPct: number;
  completedAt: string | null;
}

interface CourseModule {
  id: string;
  title: string;
  isLocked?: boolean;
  releaseDate?: string;
  lessons?: Lesson[];
}

interface Prerequisite {
  courseId: string;
  title: string;
  completed: boolean;
  enrolled: boolean;
}

interface PrerequisiteStatus {
  allSatisfied: boolean;
  prerequisites: Prerequisite[];
}

type ModuleProgressMap = Record<
  string,
  { completed: boolean; lessonProgress: Record<string, boolean> }
>;

export default function CourseDetailPage({ params }: CourseDetailPageProps) {
  const t = useTranslations('course');
  const reviewT = useTranslations('reviews');
  const [tab, setTab] = useState<
    'overview' | 'curriculum' | 'reviews' | 'qa' | 'announcements' | 'assignments' | 'forum'
  >('overview');
  const [reviewsKey, setReviewsKey] = useState(0);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [prereqStatus, setPrereqStatus] = useState<PrerequisiteStatus | null>(null);
  const [prereqLoading, setPrereqLoading] = useState(true);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgressMap>({});
  const [reviewSummary, setReviewSummary] = useState<{
    averageRating: number | null;
    total: number;
  } | null>(null);
  const [reviewSummaryError, setReviewSummaryError] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);
  const enrollmentErrorRef = useRef<HTMLParagraphElement>(null);
  const enrollmentStatusRef = useRef<HTMLParagraphElement>(null);
  const { user } = useAuth();
  const { clear: clearCompare } = useCompareStore();

  const hasUnmetPrereqs =
    prereqStatus !== null && !prereqStatus.allSatisfied && prereqStatus.prerequisites.length > 0;

  const courseId = params.id;
  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';
  const isFull =
    course?.maxEnrollment != null && (course.enrollmentCount ?? 0) >= course.maxEnrollment;

  useEffect(() => {
    async function fetchReviewSummary() {
      try {
        const response = await reviewsApi.getReviews(courseId, 'recent', 1, 1);
        setReviewSummary({ averageRating: response.averageRating, total: response.total });
        setReviewSummaryError(false);
      } catch {
        setReviewSummaryError(true);
      }
    }

    async function fetchCourse() {
      try {
        const { data } = await api.get(`/courses/${courseId}`);
        setCourse(unwrapApiResponse<CourseData>(data));
      } catch {
        // course data unavailable
      }
    }

    async function fetchEnrollmentStatus() {
      if (!user) return;
      try {
        const { data } = await api.get(`/users/${user.id}/enrollments`);
        const enrollmentRecords = unwrapApiResponse<Array<{ courseId: string }>>(data);
        const enrolled = Array.isArray(enrollmentRecords)
          ? enrollmentRecords.some((e) => e.courseId === courseId)
          : false;
        setIsEnrolled(enrolled);
      } catch {
        // not enrolled or unauthenticated
      }
    }

    const fetchModules = async () => {
      try {
        const { data: responseData } = await api.get(`/courses/${courseId}/modules`);
        const data = unwrapApiResponse<CourseModule[]>(responseData);
        const modulesWithLessons = await Promise.all(
          data.map(async (mod: CourseModule) => {
            const lessonsRes = await api.get(`/modules/${mod.id}/lessons`);
            return { ...mod, lessons: unwrapApiResponse<Lesson[]>(lessonsRes.data) };
          })
        );
        setModules(modulesWithLessons);
        // Pass fresh module data to progress fetch — avoids stale closure
        if (user) await fetchProgress(modulesWithLessons);
      } catch (error) {
        console.error('Failed to fetch course curriculum:', error);
      } finally {
        setModulesLoading(false);
      }
    };

    async function fetchPrerequisites() {
      if (!user) {
        setPrereqLoading(false);
        return;
      }
      try {
        const { data } = await api.get(`/v1/courses/${courseId}/prerequisites/status`);
        setPrereqStatus(unwrapApiResponse<PrerequisiteStatus>(data));
      } catch {
        setPrereqStatus(null);
      } finally {
        setPrereqLoading(false);
      }
    }

    async function fetchProgress(currentModules: CourseModule[]) {
      if (!user) return;
      try {
        const { data: responseData } = await api.get(`/users/${user.id}/progress`);
        const data = unwrapApiResponse<LessonProgressRecord[]>(responseData);
        // Filter progress for this course only
        const courseProgress = (data ?? []).filter((p) => p.courseId === courseId);

        // Track which lessons are completed
        const completedLessons = new Set(
          courseProgress.filter((p) => p.progressPct >= 100).map((p) => p.lessonId)
        );

        // Build progress map per module from the passed-in module data
        const progressMap: ModuleProgressMap = {};
        currentModules.forEach((mod) => {
          const modLessonIds = (mod.lessons ?? []).map((l) => l.id);
          const lessonProgress: Record<string, boolean> = {};
          let completedCount = 0;
          modLessonIds.forEach((lessonId) => {
            const isCompleted = completedLessons.has(lessonId);
            lessonProgress[lessonId] = isCompleted;
            if (isCompleted) completedCount++;
          });

          progressMap[mod.id] = {
            completed: modLessonIds.length > 0 && completedCount === modLessonIds.length,
            lessonProgress,
          };
        });

        setModuleProgress(progressMap);
      } catch {
        // Progress data unavailable — modules render without checkmarks
      }
    }

    fetchCourse();
    fetchReviewSummary();
    fetchEnrollmentStatus();
    fetchModules();
    fetchPrerequisites();
  }, [courseId, user]);

  useEffect(() => {
    if (enrollError) enrollmentErrorRef.current?.focus();
    else if (enrollmentSuccess) enrollmentStatusRef.current?.focus();
  }, [enrollError, enrollmentSuccess]);

  async function handleEnroll() {
    setEnrolling(true);
    setEnrollError(null);
    setEnrollmentSuccess(false);
    try {
      await api.post(`/courses/${courseId}/enroll`);
      setIsEnrolled(true);
      clearCompare();
      setEnrollmentSuccess(true);
    } catch (err: unknown) {
      const msg: string =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('enrollmentFailed');
      setEnrollError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-8">
      <Link href="/courses" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        ← {t('backToCourses')}
      </Link>
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-3xl font-bold">
          {course?.title ?? t('courseFallback', { id: courseId })}
        </h1>

        {/* Enrollment / Waitlist actions */}
        {user && !isInstructor && (
          <div className="shrink-0 w-48 space-y-2">
            {isEnrolled ? (
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-2 text-center">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  {t('enrolled')}
                </p>
              </div>
            ) : isFull ? (
              <WaitlistButton
                courseId={courseId}
                isFull={isFull}
                isEnrolled={isEnrolled}
                onEnrolled={() => setIsEnrolled(true)}
              />
            ) : (
              <div className="space-y-2">
                <div className="relative group">
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling || hasUnmetPrereqs}
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('enrollButton')}
                  >
                    {enrolling ? t('enrolling') : t('enrollNow')}
                  </button>
                  {hasUnmetPrereqs && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs px-3 py-2 shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 text-center">
                      {t('completePrerequisites')}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                    </div>
                  )}
                </div>
                {enrollError && (
                  <p
                    ref={enrollmentErrorRef}
                    tabIndex={-1}
                    className="text-xs text-red-600 dark:text-red-400 focus:outline-none"
                    role="alert"
                    aria-live="assertive"
                  >
                    {enrollError}
                  </p>
                )}
                {hasUnmetPrereqs && !prereqLoading && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                        {t('prerequisitesRequired')}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {prereqStatus!.prerequisites.map((p) => (
                        <li key={p.courseId} className="flex items-center gap-1.5 text-xs">
                          {p.completed ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          )}
                          {p.completed ? (
                            <span className="line-through text-gray-400 truncate">{p.title}</span>
                          ) : (
                            <Link
                              href={`/courses/${p.courseId}`}
                              className="text-blue-600 hover:underline truncate"
                            >
                              {p.title} →
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {reviewSummary && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {reviewSummary.averageRating === null
            ? reviewT('noReviews')
            : `${reviewSummary.averageRating.toFixed(1)} ★ · ${reviewT('reviewCount', { count: reviewSummary.total })}`}
        </p>
      )}
      {reviewSummaryError && (
        <p className="mb-4 text-sm text-gray-500" role="status">
          {reviewT('summaryUnavailable')}
        </p>
      )}
      {enrollmentSuccess && (
        <p
          ref={enrollmentStatusRef}
          tabIndex={-1}
          className="sr-only"
          role="status"
          aria-live="polite"
        >
          {t('enrollmentSuccess')}
        </p>
      )}
      {course?.description && (
        <p className="text-gray-600 dark:text-gray-400 mb-2">{course.description}</p>
      )}

      {course?.maxEnrollment != null && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {t('enrollmentSpots', {
            enrolled: course.enrollmentCount ?? 0,
            maximum: course.maxEnrollment,
          })}
          {isFull && (
            <span className="ml-2 inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              {t('full')}
            </span>
          )}
        </p>
      )}

      <Link
        href={`/courses/${courseId}/forum`}
        className="text-blue-600 hover:underline text-sm mb-6 inline-block"
      >
        {t('discussionForum')} →
      </Link>

      {/* Progress tracker — shown prominently above the tabs for enrolled students */}
      {user && !isInstructor && isEnrolled && (
        <div className="mb-6">
          <ProgressTracker courseId={courseId} />
        </div>
      )}

      <div className="flex gap-4 border-b mb-6 overflow-x-auto">
        {(
          [
            'overview',
            'curriculum',
            'reviews',
            'qa',
            'announcements',
            'assignments',
            'forum',
          ] as const
        ).map((tabName) => (
          <button
            key={tabName}
            className={`pb-2 px-1 capitalize text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === tabName
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab(tabName)}
          >
            {reviewT(`tabs.${tabName}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <p className="text-gray-600">{t('courseContentPlaceholder')}</p>
          {!isInstructor && <PrerequisitesPanel courseId={courseId} />}
          {!isInstructor && !isEnrolled && !isFull && (
            <div className="relative group inline-block">
              <button
                onClick={handleEnroll}
                disabled={enrolling || hasUnmetPrereqs}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 font-medium text-sm transition-colors"
              >
                {enrolling ? t('enrolling') : t('enrollNow')}
              </button>
              {hasUnmetPrereqs && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs px-3 py-2 shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 text-center">
                  {t('completePrerequisites')}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                </div>
              )}
            </div>
          )}
          <ReviewForm
            courseId={courseId}
            onSuccess={() => {
              setTab('reviews');
              setReviewsKey((k) => k + 1);
            }}
          />
        </div>
      )}

      {tab === 'curriculum' && (
        <div className="space-y-6">
          {/* Progress tracker — shown above the module list for enrolled students */}
          {user && !isInstructor && <ProgressTracker courseId={courseId} />}
          {!modulesLoading && modules.every((m) => !m.lessons?.length) && (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
              <PlayCircle className="mx-auto mb-3 h-10 w-10 text-gray-400" aria-hidden="true" />
              <h2 className="text-lg font-semibold">{t('noLessonsYet')}</h2>
              <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
                {isInstructor ? t('addFirstLesson') : t('lessonsComingSoon')}
              </p>
              <Link
                href={isInstructor ? '/instructor/dashboard' : '/courses'}
                className="inline-block rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium"
              >
                {isInstructor ? t('addLesson') : t('browseOtherCourses')}
              </Link>
            </div>
          )}
          {modules.map((mod) => {
            const modProgress = moduleProgress[mod.id];
            const isModuleCompleted = modProgress?.completed ?? false;

            return (
              <div key={mod.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  {/* Completion checkmark */}
                  {user && !mod.isLocked && (
                    <span
                      aria-hidden={!isModuleCompleted}
                      title={isModuleCompleted ? t('completed') : undefined}
                    >
                      {isModuleCompleted ? (
                        <CheckCircle2
                          className="w-5 h-5 text-green-500 shrink-0"
                          aria-label={t('completed')}
                        />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0" />
                      )}
                    </span>
                  )}
                  <h3
                    className={`font-bold text-lg ${
                      isModuleCompleted ? 'text-green-700 dark:text-green-400' : ''
                    }`}
                  >
                    {mod.title}
                  </h3>
                  {mod.isLocked ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" />
                      {mod.releaseDate
                        ? t('unlocksDate', {
                            date: new Date(mod.releaseDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }),
                          })
                        : t('locked')}
                    </span>
                  ) : mod.releaseDate ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                      <Calendar className="w-3 h-3" />
                      {t('releasedDate', {
                        date: new Date(mod.releaseDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }),
                      })}
                    </span>
                  ) : null}
                </div>
                {mod.isLocked ? (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    {t('moduleAvailableOn')}{' '}
                    {mod.releaseDate
                      ? new Date(mod.releaseDate).toLocaleString(undefined, {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        })
                      : t('futureDate')}
                    .
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mod.lessons?.map((lesson: Lesson) => {
                      const isLessonCompleted = modProgress?.lessonProgress[lesson.id] ?? false;
                      return (
                        <Link
                          key={lesson.id}
                          href={`/courses/${courseId}/lesson/${lesson.id}`}
                          className={`flex items-center justify-between p-4 bg-white dark:bg-gray-900 border rounded-lg transition-colors ${
                            isLessonCompleted
                              ? 'border-green-200 dark:border-green-900/50 hover:border-green-400'
                              : 'border-gray-200 dark:border-gray-800 hover:border-blue-500'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isLessonCompleted ? (
                              <CheckCircle2
                                className="w-5 h-5 text-green-500 shrink-0"
                                aria-label={t('completed')}
                              />
                            ) : (
                              <PlayCircle className="w-5 h-5 text-blue-500 shrink-0" />
                            )}
                            <span
                              className={`font-medium ${
                                isLessonCompleted
                                  ? 'text-green-700 dark:text-green-400'
                                  : 'text-gray-900 dark:text-gray-100'
                              }`}
                            >
                              {lesson.title}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {t('lessonMinutes', { count: lesson.durationMinutes })}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'reviews' && <ReviewList key={reviewsKey} courseId={courseId} />}

      {tab === 'qa' && (
        <QAPanel courseId={courseId} isInstructor={isInstructor} currentUserId={user?.id} />
      )}

      {tab === 'announcements' && (
        <AnnouncementsPanel courseId={courseId} isInstructor={isInstructor} />
      )}

      {tab === 'assignments' && <AssignmentsTab courseId={courseId} />}

      {tab === 'forum' && <CourseForumTab courseId={courseId} />}
    </main>
  );
}
