'use client';

export function BoardSkeleton({ size = 5 }: { size?: number }) {
  return (
    <div
      className="grid gap-1.5 w-full max-w-2xl mx-auto"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {Array.from({ length: size * size }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-lg bg-card-border/40 animate-pulse"
        />
      ))}
    </div>
  );
}

export function TeamListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-card-border rounded-xl p-4 bg-card-bg animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-card-border/60" />
            <div className="h-4 w-32 rounded bg-card-border/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 rounded bg-card-border/60" style={{ width: `${60 + i * 10}%` }} />
          <div className="h-3 w-10 rounded bg-card-border/60" />
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-red-500/30 rounded-lg p-4 bg-red-500/10 mb-4">
      <p className="text-red-400 text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
