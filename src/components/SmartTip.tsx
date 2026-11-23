'use client';

/**
 * A one-line nudge in the tile editor: what the tile does now, and the one click that does what people
 * usually mean ("Repeats count. Want each item once?" → Different items only).
 */
export default function SmartTip({ text, action, onAction, disabled }: { text: string; action?: string; onAction?: () => void; disabled?: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-gold/30 bg-gold/5 px-2.5 py-1.5 text-[11px] leading-snug text-foreground/85">
      <span>{text}</span>
      {action && onAction && (
        <button type="button" disabled={disabled} onClick={onAction} className="font-semibold text-gold hover:text-gold-light disabled:opacity-50">
          {action}
        </button>
      )}
    </div>
  );
}
