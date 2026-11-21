import { FELL_TITLE, HCW_ENTRANT_TITLE, HARDCORE_WORLDS } from '@/lib/competitionGame';
import { worldModeDef } from '@/lib/worldModes';

/**
 * The small marks a competition row carries when it isn't plain main-game play: an "HCW" tag on a
 * Hardcore Worlds character, and a muted "fell" on one that died mid-way. Nothing at all otherwise,
 * so a main-game board looks exactly as it always has.
 */

const HCW_ICON = worldModeDef(HARDCORE_WORLDS)?.icon ?? null;

/** The game's Hardcore Worlds icon, decorative: whatever carries it says the words. */
export function HcwIcon({ className = 'h-3 w-3' }: { className?: string }) {
  if (!HCW_ICON) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={HCW_ICON} alt="" aria-hidden className={`inline-block shrink-0 object-contain ${className}`} />;
}

export function HcwTag() {
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-1 rounded border border-[#7a2a24] bg-[#2a1412] px-1.5 py-px align-middle text-[10px] font-bold leading-none tracking-wider text-[#ff9a8a]"
      title={HCW_ENTRANT_TITLE}
    >
      <HcwIcon />
      HCW
    </span>
  );
}

export function FellTag() {
  return (
    <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-text-dim" title={FELL_TITLE}>
      fell
    </span>
  );
}

/** Both marks for one entrant, in the order they read. */
export function EntrantTags({ hcw, stopped }: { hcw?: boolean; stopped?: boolean }) {
  return (
    <>
      {hcw && <HcwTag />}
      {stopped && <FellTag />}
    </>
  );
}

/**
 * "How it's counted", for a competition that races the main game and Hardcore Worlds together:
 * the one case where two kinds of character share a board, so the page says how each is scored.
 */
export function MixedGameNote() {
  return (
    <div className="mt-5 rounded-xl border border-card-border bg-card-bg p-4">
      <h3 className="text-sm font-bold">How it&apos;s counted</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12.5px] text-text-muted">
        <li>Main game and Hardcore Worlds characters race together: same rates, same scoring.</li>
        <li>
          A<HcwTag /> character is scored from the Hardcore Worlds hiscores. Everyone else from the main hiscores.
        </li>
        <li>Someone with a main and a Hardcore Worlds character has two entries, the same as an alt.</li>
      </ul>
    </div>
  );
}
