import { cn } from '@/lib/utils';

const TITLE =
  "The plugin can't auto-detect this as a drop — it's a shop / gamble / reward-interface item. " +
  'It only auto-counts a fresh in-game collection-log unlock during the event. Already own it? Submit a screenshot manually.';

// Shown on tiles whose item(s) the plugin cannot drop-track (see isManualOnlyDropTile / clogManual.ts).
// `compact` renders a tiny chip for dense lists / board faces; the default is a labelled badge.
export default function ManualOnlyBadge({ compact, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <span
        title={TITLE}
        className={cn(
          'inline-flex items-center gap-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 font-bold leading-none px-1 py-0.5 text-[9px]',
          className,
        )}
      >
        ✋ Manual
      </span>
    );
  }
  return (
    <span
      title={TITLE}
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-400/30 font-semibold px-2 py-0.5 text-[11px]',
        className,
      )}
    >
      ✋ Not auto-tracked — submit manually
    </span>
  );
}
