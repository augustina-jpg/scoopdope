'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { reviewsApi, Review, SortCriterion } from '@/lib/reviewsApi';
import { StarRating } from './StarRating';
import { InstructorReply } from './InstructorReply';

function FlagButton({ courseId, reviewId }: { courseId: string; reviewId: string }) {
  const t = useTranslations('reviews');
  const [flagged, setFlagged] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleFlag() {
    if (flagged) return;
    setLoading(true);
    try {
      await reviewsApi.flagReview(courseId, reviewId);
      setFlagged(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleFlag}
      disabled={loading || flagged}
      className={`text-xs ${flagged ? 'text-red-500 cursor-default' : 'text-gray-400 hover:text-red-500'} transition-colors`}
      aria-label={flagged ? t('flagged') : t('flagReview')}
      title={flagged ? t('flaggedTitle') : t('flagTitle')}
    >
      {flagged ? `⚑ ${t('flaggedAction')}` : `⚐ ${t('flagAction')}`}
    </button>
  );
}

interface ReviewListProps {
  courseId: string;
  isInstructor?: boolean;
}

const SORT_OPTIONS: SortCriterion[] = ['recent', 'highest'];

export function ReviewList({ courseId, isInstructor = false }: ReviewListProps) {
  const t = useTranslations('reviews');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [sort, setSort] = useState<SortCriterion>('recent');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    let active = true;
    reviewsApi
      .getReviews(courseId, sort, page)
      .then((response) => {
        if (!active) return;
        const pageReviews = response.data.map((review) => ({
          ...review,
          text: review.text ?? '',
          authorName: review.authorName || t('student'),
        }));
        setReviews(pageReviews);
        setAverageRating(response.averageRating);
        setTotalCount(response.total);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId, sort, page, t]);

  const pageCount = Math.max(1, Math.ceil(totalCount / 10));

  return (
    <section aria-label={t('courseReviews')}>
      <div className="flex items-center justify-between mb-4">
        <div>
          {averageRating !== null ? (
            <span className="text-2xl font-bold">
              {averageRating.toFixed(1)} <span className="text-yellow-400">★</span>
              <span className="text-sm text-gray-500 ml-2">
                ({t('reviewCount', { count: totalCount })})
              </span>
            </span>
          ) : (
            <span className="text-gray-500">{t('noReviews')}</span>
          )}
        </div>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortCriterion)}
          aria-label={t('sortReviews')}
        >
          {SORT_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {t(`sort.${value}`)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="text-red-600" role="alert">
          {t('loadError')}
        </p>
      ) : loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse border rounded-lg p-4 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-3 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-gray-500">{t('noReviews')}</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{review.authorName}</span>
                <span className="text-xs text-gray-400">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              <StarRating value={review.rating} readOnly />
              <p className="mt-2 text-sm text-gray-700">{review.text}</p>
              <div className="flex items-center justify-between mt-2">
                <InstructorReply
                  courseId={courseId}
                  reviewId={review.id}
                  existingReply={review.instructorReply}
                  isInstructor={isInstructor}
                />
                <FlagButton courseId={courseId} reviewId={review.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label={t('reviewPagination')}>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
          >
            {t('previous')}
          </button>
          <span className="text-sm text-gray-500">{t('pageOf', { page, pageCount })}</span>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            disabled={page === pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('next')}
          </button>
        </nav>
      )}
    </section>
  );
}
