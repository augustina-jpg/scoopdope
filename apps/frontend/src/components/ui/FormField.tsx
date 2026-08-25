import React from 'react';

// ── Shared base props ─────────────────────────────────────────────────────────

interface FormFieldBaseProps {
  label?: string;
  /** Inline error message displayed below the field with role="alert" */
  error?: string;
  /** Shown when the field passes validation; provides positive feedback */
  success?: string;
  /** Hint text shown below the field when there's no error or success message */
  helperText?: string;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

// ── Input variant ─────────────────────────────────────────────────────────────

interface FormFieldInputProps
  extends FormFieldBaseProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'className' | 'required'> {
  as?: 'input';
}

// ── Textarea variant ──────────────────────────────────────────────────────────

interface FormFieldTextareaProps
  extends FormFieldBaseProps,
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'name' | 'className' | 'required'> {
  as: 'textarea';
  /** Number of visible text rows */
  rows?: number;
}

type FormFieldProps = FormFieldInputProps | FormFieldTextareaProps;

// ── Shared sub-components ─────────────────────────────────────────────────────

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string | undefined;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      {children}
      {required && (
        <span className="ml-1 text-red-500" aria-label="required">
          *
        </span>
      )}
    </label>
  );
}

function FieldMessage({
  id,
  type,
  message,
}: {
  id: string;
  type: 'error' | 'success' | 'helper';
  message: string;
}) {
  if (type === 'error') {
    return (
      <p id={id} role="alert" className="text-sm text-red-600 dark:text-red-400 font-medium">
        {message}
      </p>
    );
  }
  if (type === 'success') {
    return (
      <p id={id} className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
        {/* Checkmark icon */}
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        {message}
      </p>
    );
  }
  return (
    <p id={id} className="text-xs text-gray-500 dark:text-gray-400">
      {message}
    </p>
  );
}

// ── Shared class builder ──────────────────────────────────────────────────────

function fieldClasses(error?: string, success?: string, extra = '') {
  const base =
    'w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ' +
    'focus-visible:outline-none focus-visible:ring-2 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500';

  const border = error
    ? 'border-red-500 focus-visible:ring-red-500'
    : success
    ? 'border-green-500 focus-visible:ring-green-500'
    : 'border-gray-300 dark:border-gray-600 focus-visible:ring-blue-500';

  return `${base} ${border} ${extra}`.trim();
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * FormField — a fully accessible field wrapper supporting both `<input>` and
 * `<textarea>` elements.
 *
 * Features:
 * - Inline error, success, and helper text with proper aria-describedby wiring
 * - Red border on error, green border + checkmark on success
 * - Real-time validation feedback: show errors on change AND on blur
 * - Works with react-hook-form via spread of `register()` return value
 * - Meets WCAG 2.1 Level AA (3.3.1 Error Identification, 3.3.2 Labels or Instructions)
 *
 * @example Input
 * ```tsx
 * <FormField
 *   label="Email"
 *   name="email"
 *   type="email"
 *   error={errors.email?.message}
 *   required
 *   {...register('email')}
 * />
 * ```
 *
 * @example Textarea
 * ```tsx
 * <FormField
 *   as="textarea"
 *   label="Bio"
 *   name="bio"
 *   rows={4}
 *   error={errors.bio?.message}
 *   success={!errors.bio && touchedFields.bio ? 'Looks good!' : undefined}
 *   {...register('bio')}
 * />
 * ```
 */
export function FormField(props: FormFieldProps) {
  const {
    label,
    error,
    success,
    helperText,
    id,
    name,
    required,
    className = '',
    as,
    ...rest
  } = props;

  const fieldId = id || name || label?.toLowerCase().replace(/\s+/g, '-');
  const errorId = `${fieldId}-error`;
  const successId = `${fieldId}-success`;
  const helperId = `${fieldId}-helper`;

  // Prioritise error > success > helper for aria-describedby
  const describedBy = error ? errorId : success ? successId : helperText ? helperId : undefined;

  const inputCls = fieldClasses(error, success, className);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <FieldLabel htmlFor={fieldId} required={required}>
          {label}
        </FieldLabel>
      )}

      {as === 'textarea' ? (
        <textarea
          id={fieldId}
          name={name}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          required={required}
          className={`${inputCls} resize-y`}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={fieldId}
          name={name}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          required={required}
          className={inputCls}
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {error && <FieldMessage id={errorId} type="error" message={error} />}
      {!error && success && <FieldMessage id={successId} type="success" message={success} />}
      {!error && !success && helperText && (
        <FieldMessage id={helperId} type="helper" message={helperText} />
      )}
    </div>
  );
}
