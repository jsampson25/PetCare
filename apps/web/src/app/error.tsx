'use client';

import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-24">
      <Alert title="This page could not be loaded" tone="danger">
        <p>No changes were made. Try the page again, or return later if the problem continues.</p>
        <div className="mt-4">
          <Button onClick={reset} variant="secondary">
            Try again
          </Button>
        </div>
      </Alert>
    </main>
  );
}
