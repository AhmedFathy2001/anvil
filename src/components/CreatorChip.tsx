/**
 * The small "Creator" tag beside a creator space's name (lib/creatorSpaces), wherever spaces are
 * listed next to clans. The same look the Clan Hall cards use.
 */
export default function CreatorChip({ className = '' }: { className?: string }) {
  return (
    <span
      className={`shrink-0 rounded border border-gold/30 bg-gold/10 px-1.5 py-px text-[10.5px] font-medium text-gold ${className}`}
      title="A creator space: a streamer's or group's home for events, not an in-game clan"
    >
      Creator
    </span>
  );
}
