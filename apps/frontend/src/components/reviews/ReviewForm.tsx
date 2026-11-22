'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StarRating } from './StarRating';
import { Button } from '@/components/ui/Button';
import { reviewsApi } from '@/lib/reviewsApi';

const MAX_CHARS = 1000;
const COUNTER_THRESHOLD = 900;

interface ReviewFormProps {
  courseId: string;
  onSuccess: () => void;
}

export function ReviewForm({ courseId, onSuccess }: ReviewFormProps) {
  const t = useTranslations('reviews');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const ratingInputRef = useRef<HTMLInputElement>(null);
  const reviewTextRef = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [focusError, setFocusError] = useState(false);

  const remaining = MAX_CHARS - text.length;

  useEffect(() => {
    if (error && focusError) {
      errorRef.current?.focus();
      setFocusError(false);
    }
  }, [error, focusError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError(t('ratingRequired'));
      setFocusError(true);
      ratingInputRef.current?.focus();
      return;
    }
    if (!text.trim()) {
      setError(t('textRequired'));
      setFocusError(true);
      reviewTextRef.current?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await reviewsApi.submitReview(courseId, rating, text);
      setSuccess(true);
      onSuccess();
    } catch {
      setError(t('submitError'));
      setFocusError(true);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <p className="text-green-600 font-medium" role="status">
        {t('submitted')}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-medium">{t('yourRating')}</p>
        <StarRating
          value={rating}
          onRatingChange={(value) => {
            setRating(value);
            setError(null);
          }}
          inputRef={ratingInputRef}
          required
          invalid={Boolean(error && !rating)}
          errorId={error ? 'course-review-error' : undefined}
        />
      </div>
      <div>
        <label htmlFor="course-review-text" className="block text-sm font-medium mb-1">
          {t('yourReview')}
        </label>
        <textarea
          id="course-review-text"
          ref={reviewTextRef}
          className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          maxLength={MAX_CHARS}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={() => setError(null)}
          placeholder={t('reviewPlaceholder')}
          aria-required="true"
          aria-invalid={Boolean(error && !text.trim())}
          aria-describedby={error && !text.trim() ? 'course-review-error' : undefined}
        />
        {text.length >= COUNTER_THRESHOLD && (
          <p className={`text-xs mt-1 ${remaining <= 50 ? 'text-red-500' : 'text-gray-500'}`}>
            {t('charactersRemaining', { count: remaining })}
          </p>
        )}
      </div>
      {error && (
        <p
          id="course-review-error"
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="text-red-600 text-sm focus:outline-none"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading || !rating || !text.trim()}>
        {loading ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
