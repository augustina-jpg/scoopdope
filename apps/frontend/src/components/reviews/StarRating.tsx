'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';

interface StarRatingProps {
  value: number;
  readOnly?: boolean;
  onRatingChange?: (rating: number) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  required?: boolean;
  invalid?: boolean;
  errorId?: string;
}

export function StarRating({
  value,
  readOnly = false,
  onRatingChange,
  inputRef,
  required = false,
  invalid = false,
  errorId,
}: StarRatingProps) {
  // Unique ID prefix to avoid collisions when multiple widgets appear on one page
  const groupId = useId();
  const t = useTranslations('reviews');

  if (readOnly) {
    return (
      <span className="flex gap-0.5" aria-label={t('ratingOutOfFive', { rating: value })}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= value ? 'text-yellow-400' : 'text-gray-300'}
            aria-hidden="true"
          >
            ★
          </span>
        ))}
      </span>
    );
  }

  return (
    <fieldset
      className="flex gap-0.5"
      role="radiogroup"
      aria-label={t('starRating')}
      aria-required={required}
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
      // Remove the default fieldset border/padding
      style={{ border: 'none', padding: 0, margin: 0 }}
    >
      {/* Screen-reader-only legend so assistive tech has a group label */}
      <legend className="sr-only">{required ? t('yourRatingRequired') : t('yourRating')}</legend>

      {[1, 2, 3, 4, 5].map((star) => {
        const inputId = `${groupId}-star-${star}`;
        const checked = star === value;

        return (
          <label
            key={star}
            htmlFor={inputId}
            className={`
              text-2xl cursor-pointer transition-colors select-none
              ${star <= value ? 'text-yellow-400' : 'text-gray-300'}
              hover:text-yellow-400
              has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:rounded
            `}
            aria-label={t('ratingStarLabel', { rating: star })}
          >
            {/* Visually hidden radio input — keyboard / screen-reader accessible */}
            <input
              id={inputId}
              type="radio"
              name={`${groupId}-star-rating`}
              value={star}
              checked={checked}
              onChange={() => onRatingChange?.(star)}
              ref={star === 1 ? inputRef : undefined}
              required={required}
              className="sr-only"
              aria-label={t('ratingStarLabel', { rating: star })}
            />
            ★
          </label>
        );
      })}
    </fieldset>
  );
}
