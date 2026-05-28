'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { ReviewList } from '@/components/reviews/ReviewList';
import { QAPanel } from '@/components/courses/QAPanel';
import { AnnouncementsPanel } from '@/components/courses/AnnouncementsPanel';
import { AssignmentsTab } from '@/components/assignments/AssignmentsTab';
import { useAuth } from '@/hooks/useAuth';
import { useCompareStore } from '@/store/compare.store';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import { PlayCircle, Lock, Calendar } from 'lucide-react';

interface CourseDetailPageProps {
  params: { id: string };
}

export default function CourseDetailPage({ params }: CourseDetailPageProps) {
  const [tab, setTab] = useState<'overview' | 'curriculum' | 'reviews' | 'qa' | 'announcements' | 'assignments'>('overview');
  const [reviewsKey, setReviewsKey] = useState(0);
  const [modules, setModules] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const { user } = useAuth();
  const { clear: clearCompare } = useCompareStore();

  const courseId = params.id;
  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      await api.post('/v1/enrollments', { courseId });
      clearCompare();
      toast.success('Enrolled successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const { data } = await api.get(`/courses/${courseId}/modules`);
        const modulesWithLessons = await Promise.all(
          data.map(async (mod: any) => {
            const lessonsRes = await api.get(`/modules/${mod.id}/lessons`);
            return { ...mod, lessons: lessonsRes.data };
          })
        );
        setModules(modulesWithLessons);
      } catch (error) {
        console.error('Failed to fetch course curriculum:', error);
      }
    };
    fetchModules();
  }, [courseId]);

  return (
    <main className="max-w-4xl mx-auto p-8">
      <Link href="/courses" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        ← Back to Courses
      </Link>
      <h1 className="text-3xl font-bold mb-2">Course {courseId}</h1>
      <Link href={`/courses/${courseId}/forum`} className="text-blue-600 hover:underline text-sm mb-6 inline-block">
        View Discussion Forum →
      </Link>

      <div className="flex gap-4 border-b mb-6 overflow-x-auto">
        {(['overview', 'curriculum', 'reviews', 'qa', 'announcements', 'assignments'] as const).map((t) => (
          <button
            key={t}
            className={`pb-2 px-1 capitalize text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'qa' ? 'Q&A' : t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <p className="text-gray-600">Course content and details would appear here.</p>
          {!isInstructor && (
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 font-medium text-sm transition-colors"
            >
              {enrolling ? 'Enrolling…' : 'Enroll Now'}
            </button>
          )}
          <ReviewForm courseId={courseId} onSuccess={() => { setTab('reviews'); setReviewsKey((k) => k + 1); }} />
        </div>
      )}

      {tab === 'curriculum' && (
        <div className="space-y-6">
          {modules.map((mod) => (
            <div key={mod.id} className="space-y-3">
              <h3 className="font-bold text-lg">{mod.title}</h3>
              <div className="space-y-2">
                {mod.lessons?.map((lesson: any) => (
                  <Link
                    key={lesson.id}
                    href={`/courses/${courseId}/lesson/${lesson.id}`}
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-lg hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <PlayCircle className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">{lesson.title}</span>
                    </div>
                    <span className="text-sm text-gray-500">{lesson.durationMinutes} min</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'reviews' && (
        <ReviewList key={reviewsKey} courseId={courseId} />
      )}

      {tab === 'qa' && (
        <QAPanel
          courseId={courseId}
          isInstructor={isInstructor}
          currentUserId={user?.id}
        />
      )}

      {tab === 'announcements' && (
        <AnnouncementsPanel courseId={courseId} isInstructor={isInstructor} />
      )}

      {tab === 'assignments' && (
        <AssignmentsTab courseId={courseId} />
      )}
    </main>
  );
}
