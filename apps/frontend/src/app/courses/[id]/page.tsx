'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { ReviewList } from '@/components/reviews/ReviewList';
import { QAPanel } from '@/components/courses/QAPanel';
import { AnnouncementsPanel } from '@/components/courses/AnnouncementsPanel';
import { AssignmentsTab } from '@/components/assignments/AssignmentsTab';
import { useAuth } from '@/hooks/useAuth';

interface CourseDetailPageProps {
  params: { id: string };
}

export default function CourseDetailPage({ params }: CourseDetailPageProps) {
  const [tab, setTab] = useState<'overview' | 'reviews' | 'qa' | 'announcements' | 'assignments'>('overview');
  const [reviewsKey, setReviewsKey] = useState(0);
  const { user } = useAuth();

  const courseId = params.id;
  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

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
        {(['overview', 'reviews', 'qa', 'announcements', 'assignments'] as const).map((t) => (
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
          <ReviewForm courseId={courseId} onSuccess={() => { setTab('reviews'); setReviewsKey((k) => k + 1); }} />
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
