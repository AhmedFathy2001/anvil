import { earlyBird } from '@/lib/plans';

/**
 * "Early-bird pricing": the one line shown beside prices (lib/plans earlyBird is the single config:
 * off, reworded, or with the price-lock promise). A small gold badge and its sentence, never a banner.
 * Renders nothing when switched off.
 */
export default function EarlyBirdBadge({ className = '', center = false }: { className?: string; center?: boolean }) {
  const eb = earlyBird();
  if (!eb) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] leading-snug text-text-muted ${center ? 'justify-center text-center' : ''} ${className}`}>
      <span className="shrink-0 rounded-full border border-gold/45 bg-gold/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-gold">
        {eb.heading}
      </span>
      <span className="min-w-0">
        {eb.line}
        {eb.lock && <> {eb.lock}</>}
      </span>
    </p>
  );
}
