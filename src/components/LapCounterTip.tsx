/**
 * Agility lap tiles credit off the game's "Your <course> lap count is: N" line, and that line only
 * prints while the lap counter is switched on. It's a per-player game setting toggled at Grace in
 * the Rogues' Den, so a player with it off runs laps the plugin never hears about.
 */
export default function LapCounterTip({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex gap-3 items-start">
      {!compact && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/guide/agility-lap-counter-grace.png"
          width={125}
          height={128}
          alt="Grace's right-click menu with the Toggle Counter option"
          className="rounded border border-card-border shrink-0"
        />
      )}
      <p className="text-xs text-amber-200/90 leading-relaxed">
        <span className="font-semibold text-amber-300">Turn your lap counter on first.</span> Laps only count
        when the game prints &ldquo;Your &hellip; lap count is&rdquo; after each lap. If yours doesn&rsquo;t,
        right-click <span className="text-foreground/80">Grace</span> in the Rogues&rsquo; Den (under Burthorpe)
        and pick <span className="text-foreground/80">Toggle Counter</span>.
      </p>
    </div>
  );
}
