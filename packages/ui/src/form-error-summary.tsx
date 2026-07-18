export type FormError = {
  fieldId: string;
  message: string;
};

export function FormErrorSummary({ errors }: { errors: readonly FormError[] }) {
  if (errors.length === 0) return null;

  return (
    <div
      className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-background)] p-4 text-[var(--danger-foreground)]"
      role="alert"
      tabIndex={-1}
    >
      <h2 className="font-bold">
        Correct {errors.length === 1 ? 'this problem' : 'these problems'}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a className="font-semibold underline" href={`#${error.fieldId}`}>
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
