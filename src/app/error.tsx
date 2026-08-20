'use client';

import { useEffect } from 'react';
import ClanLink from '@/components/ClanLink';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[root] render error', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg mt-16 p-4">
      <div className="border border-red-500/30 rounded-xl p-6 bg-red-500/5">
        <h1 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h1>
        <p className="text-sm text-text-muted mb-4">
          {error.message || 'An unexpected error occurred.'}
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
            href="/"
            className="px-4 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
          >
            Home
          </ClanLink>
        </div>
      </div>
    </div>
  );
}
