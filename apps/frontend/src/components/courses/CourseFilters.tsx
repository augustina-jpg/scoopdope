'use client';

import { useState } from 'react';
import {
  LEVELS,
  CATEGORIES,
  LANGUAGES,
  DURATIONS,
  PRICE_RANGES,
  SORT_OPTIONS,
  RATING_FILTERS,
  ENROLLMENT_RANGES,
  DATE_RANGES,
  type SortOption,
} from '@/app/courses/courses.config';

const cls =
  'rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

type Props = {
  level: string;
  language: string;
  category: string;
  duration: string;
  price: string;
  sort: SortOption;
  instructor: string;
  minRating: string;
  enrollmentRange: string;
  dateRange: string;
  onChange: (key: string, value: string) => void;
};

export function CourseFilters({
  level,
  language,
  category,
  duration,
  price,
  sort,
  instructor,
  minRating,
  enrollmentRange,
  dateRange,
  onChange,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const advancedCount = [instructor, minRating, enrollmentRange, dateRange].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Basic filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={level}
          onChange={(e) => onChange('level', e.target.value)}
          className={cls}
          aria-label="Filter by level"
        >
          <option value="">All Levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={language}
          onChange={(e) => onChange('language', e.target.value)}
          className={cls}
          aria-label="Filter by language"
        >
          <option value="">All Languages</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => onChange('category', e.target.value)}
          className={cls}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={duration}
          onChange={(e) => onChange('duration', e.target.value)}
          className={cls}
          aria-label="Filter by duration"
        >
          <option value="">Any Duration</option>
          {DURATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <select
          value={price}
          onChange={(e) => onChange('price', e.target.value)}
          className={cls}
          aria-label="Filter by price"
        >
          <option value="">Any Price</option>
          {PRICE_RANGES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => onChange('sort', e.target.value)}
          className={cls}
          aria-label="Sort courses"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Advanced filters toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-expanded={showAdvanced}
          aria-controls="advanced-filters"
        >
          Advanced Filters
          {advancedCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
              {advancedCount}
            </span>
          )}
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div
          id="advanced-filters"
          className="flex flex-wrap gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
        >
          {/* Instructor name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="instructor-filter" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Instructor
            </label>
            <input
              id="instructor-filter"
              type="text"
              value={instructor}
              onChange={(e) => onChange('instructor', e.target.value)}
              placeholder="Search by name…"
              className={`${cls} w-44`}
              aria-label="Filter by instructor name"
            />
          </div>

          {/* Minimum rating */}
          <div className="flex flex-col gap-1">
            <label htmlFor="rating-filter" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Min Rating
            </label>
            <select
              id="rating-filter"
              value={minRating}
              onChange={(e) => onChange('minRating', e.target.value)}
              className={cls}
              aria-label="Filter by minimum rating"
            >
              <option value="">Any Rating</option>
              {RATING_FILTERS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Enrollment count */}
          <div className="flex flex-col gap-1">
            <label htmlFor="enrollment-filter" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Enrollment
            </label>
            <select
              id="enrollment-filter"
              value={enrollmentRange}
              onChange={(e) => onChange('enrollmentRange', e.target.value)}
              className={cls}
              aria-label="Filter by enrollment count"
            >
              <option value="">Any Enrollment</option>
              {ENROLLMENT_RANGES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          {/* Publish date */}
          <div className="flex flex-col gap-1">
            <label htmlFor="date-filter" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Published
            </label>
            <select
              id="date-filter"
              value={dateRange}
              onChange={(e) => onChange('dateRange', e.target.value)}
              className={cls}
              aria-label="Filter by publish date"
            >
              <option value="">Any Time</option>
              {DATE_RANGES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
