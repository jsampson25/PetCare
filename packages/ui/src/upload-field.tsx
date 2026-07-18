'use client';

import type { ChangeEvent } from 'react';

export const DEFAULT_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;

export function validateSelectedFile(
  file: Pick<File, 'size' | 'type'>,
  acceptedTypes: readonly string[],
  maxBytes = DEFAULT_UPLOAD_LIMIT_BYTES,
) {
  if (file.size > maxBytes) return 'The selected file is larger than the allowed limit.';
  if (!acceptedTypes.includes(file.type)) return 'The selected file type is not supported.';
  return null;
}

export function UploadField({
  accept,
  error,
  hint,
  id,
  label,
  onSelect,
}: {
  accept: readonly string[];
  error?: string;
  hint: string;
  id: string;
  label: string;
  onSelect?: (file: File | null) => void;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onSelect?.(event.currentTarget.files?.[0] ?? null);
  }

  return (
    <div>
      <label className="block text-sm font-bold" htmlFor={id}>
        {label}
      </label>
      <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]" id={`${id}-hint`}>
        {hint}
      </p>
      <input
        accept={accept.join(',')}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
        aria-invalid={error ? true : undefined}
        className="mt-3 block w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] p-3 text-sm file:mr-4 file:min-h-10 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--surface-subtle)] file:px-4 file:font-bold"
        id={id}
        onChange={handleChange}
        type="file"
      />
      {error ? (
        <p
          className="mt-2 text-sm font-semibold text-[var(--danger-foreground)]"
          id={`${id}-error`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
