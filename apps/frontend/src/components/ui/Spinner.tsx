interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label announced to screen readers */
  label?: string;
  /** Colour variant — defaults to 'blue' */
  color?: 'blue' | 'white' | 'gray';
  /** When true, renders the spinner centred in a full-page overlay */
  fullPage?: boolean;
  className?: string;
}

const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' } as const;

const colors = {
  blue: 'text-blue-600 dark:text-blue-400',
  white: 'text-white',
  gray: 'text-gray-400 dark:text-gray-500',
} as const;

export function Spinner({
  size = 'md',
  label = 'Loading…',
  color = 'blue',
  fullPage = false,
  className = '',
}: SpinnerProps) {
  const spinnerEl = (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      className={`inline-flex items-center justify-center ${className}`}
    >
      <svg
        className={`animate-spin ${colors[color]} ${sizes[size]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
        {spinnerEl}
      </div>
    );
  }

  return spinnerEl;
}

/**
 * Inline button spinner — rendered inside a button while a form is submitting.
 *
 * @example
 * <button disabled={submitting}>
 *   {submitting ? <ButtonSpinner /> : null} Save
 * </button>
 */
export function ButtonSpinner({ label = 'Processing…' }: { label?: string }) {
  return (
    <Spinner size="sm" color="white" label={label} className="mr-2" />
  );
}
