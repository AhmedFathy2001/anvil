'use client';

import { useEffect } from 'react';
import ClanLink from '@/components/ClanLink';

// Next.js error.tsx must be a Client Component. Renders inside the admin
// segment whenever a page throws. Logging is client-side only (server errors
// already go through src/lib/logger.ts on the API side).
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[admin] render error', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg mt-16">
      <div className="border border-red-500/30 rounded-xl p-6 bg-red-500/5">
        <h1 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h1>
        <p className="text-sm text-text-muted mb-4">
          {error.message || 'An unexpected error occurred while rendering this page.'}
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-text-muted mb-4">digest: {error.digest}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors"
          >
            Try again
          </button>
          <ClanLink
            href="/admin/dashboard"
            className="px-4 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
          >
            Back to dashboard
          </ClanLink>
        </div>
      </div>
    </div>
  );
}
