import { cn } from '@/lib/utils';

const TITLE =
  "The plugin can't auto-detect this as a drop — it's a shop / gamble / reward-interface item. " +
  'It only auto-counts a fresh in-game collection-log unlock during the event. Already own it? Submit a screenshot manually.';
const STAFF_TITLE = 'Staff turned auto-tracking off for this tile — the plugin ignores it and staff complete it by hand.';

// Shown on tiles the plugin doesn't track (see isManualTile / clogManual.ts): items it cannot drop-track,
// or `byStaff` — an admin switched the tile to complete-by-hand. `compact` renders a tiny chip for dense
// lists / board faces; the default is a labelled badge.
export default function ManualOnlyBadge({ compact, byStaff, className }: { compact?: boolean; byStaff?: boolean; className?: string }) {
  const title = byStaff ? STAFF_TITLE : TITLE;
  if (compact) {
    return (
      <span
        title={title}
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
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-400/30 font-semibold px-2 py-0.5 text-[11px]',
        className,
      )}
    >
      {byStaff ? '✋ Not auto-tracked — completed by staff' : '✋ Not auto-tracked — submit manually'}
    </span>
  );
}
