'use client';

import { proxyWikiUrl } from '@/lib/assetUrls';
import { formatGp } from '@/lib/adminEventsFormat';
import { HARDCORE_WORLDS, MAIN, MAIN_AND_HARDCORE, parseCountsOn, type PrizeCurrency } from '@/lib/competitionGame';
import { modeHiscoresTable } from '@/lib/modeHiscores';
import { WORLD_MODES, modeTag, worldModeDef } from '@/lib/worldModes';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// "Which game counts" and "Paid in" (lib/competitionGame), shared by the setup form (EventForm) and
// a competition's Settings tab, so both offer the same choices in the same words.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The game's Hardcore Worlds icon, through our wiki image cache. */
const HCW_ICON = proxyWikiUrl(worldModeDef(HARDCORE_WORLDS)?.icon ?? null);

export function HcwIcon({ size = 16, title }: { size?: number; title?: string }) {
  if (!HCW_ICON) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={HCW_ICON} alt="" aria-hidden={title ? undefined : true} title={title} width={size} height={size} className="shrink-0 object-contain" />
  );
}

/**
 * The modes a competition of this kind may count on its own. A skill or boss competition is scored
 * from hiscores, so only a mode with a hiscores table; a hunt counts drops, so any mode but beta
 * worlds (a throwaway save nobody should win a prize on).
 */
export function countsOnModes(type: string): { key: string; label: string }[] {
  return WORLD_MODES.filter((m) => (type === 'hunt' ? m.key !== 'beta' : modeHiscoresTable(m.key) !== null)).map((m) => ({ key: m.key, label: m.label }));
}

/** The "Counts on" and "Scored from" lines of the setup form's summary. */
export function countsOnSummary(countsOn: string, type: string): { countsOn: string; scoredFrom: string } {
  const c = parseCountsOn(countsOn);
  const hunt = type === 'hunt';
  if (c === MAIN) return { countsOn: 'Main game characters', scoredFrom: hunt ? 'drops on main game worlds' : 'the main game hiscores' };
  if (c === MAIN_AND_HARDCORE) {
    return {
      countsOn: 'Main game and Hardcore Worlds characters',
      scoredFrom: hunt ? 'drops on main game and Hardcore Worlds worlds' : "each character's own hiscores: main, or Hardcore Worlds",
    };
  }
  const tag = modeTag(c) ?? c;
  return { countsOn: `${tag} characters only`, scoredFrom: hunt ? `drops on ${tag} worlds` : `the ${tag} hiscores` };
}

/** One big radio card, the look the mockup and the form's other one-of choices share. */
function Card({ active, disabled, onClick, title, blurb, icon }: { active: boolean; disabled?: boolean; onClick: () => void; title: string; blurb: string; icon?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={`min-w-0 flex-[1_1_220px] rounded-xl border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? 'border-gold bg-gold/10' : 'border-card-border bg-brown-dark/30 hover:border-gold/40'
      }`}
    >
      <span className={`flex items-center gap-2 text-sm font-semibold ${active ? 'text-gold' : ''}`}>
        {icon && <HcwIcon />}
        {title}
      </span>
      <span className="mt-0.5 block text-xs leading-snug text-text-muted">{blurb}</span>
    </button>
  );
}

/**
 * Main game / Main game + Hardcore Worlds / One mode on its own; the last opens a row of mode chips.
 * `value` is the stored setting ('main', 'main+hardcore' or a mode key).
 */
export function CountsOnChoice({ value, onChange, type, disabled = false }: { value: string; onChange: (next: string) => void; type: string; disabled?: boolean }) {
  const c = parseCountsOn(value);
  const own = c !== MAIN && c !== MAIN_AND_HARDCORE;
  const modes = countsOnModes(type);
  // A stored mode this kind can't use any more (a hunt's mode, switched to a skill competition) stays
  // visible so the save error that follows makes sense.
  const shown = own && !modes.some((m) => m.key === c) ? [...modes, { key: c, label: modeTag(c) ?? c }] : modes;
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Which game counts" className="flex flex-wrap gap-2">
        <Card active={c === MAIN} disabled={disabled} onClick={() => onChange(MAIN)} title="Main game" blurb="As today. The default." />
        <Card
          active={c === MAIN_AND_HARDCORE}
          disabled={disabled}
          onClick={() => onChange(MAIN_AND_HARDCORE)}
          title="Main game + Hardcore Worlds"
          blurb="Same rates, so both race together. A Hardcore Worlds character enters as its own player."
        />
        {/* Picking the card starts on the first mode offered, so the setting is always a real mode. */}
        <Card active={own} disabled={disabled} onClick={() => !own && onChange(modes[0]?.key ?? MAIN)} title="One mode on its own" blurb="Only that mode's worlds and hiscores count." />
      </div>
      {own && (
        <div className="space-y-2 rounded-xl border border-dashed border-card-border p-3">
          <div role="radiogroup" aria-label="Which mode" className="flex flex-wrap gap-2">
            {shown.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={c === m.key}
                disabled={disabled}
                onClick={() => onChange(m.key)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  c === m.key ? 'border-gold bg-gold/10 text-gold' : 'border-card-border hover:border-gold/40'
                }`}
              >
                {m.key === HARDCORE_WORLDS && <HcwIcon size={14} />}
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-text-muted">
            Leagues and Deadman run on the main account at their own rates, so they never mix with anything.
            {type !== 'hunt' ? ' Only modes with their own hiscores can score a skill or boss competition.' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Main game gp / Hardcore Worlds gp, each with what its coffer has free. Shown only where the clan
 * keeps a Hardcore Worlds coffer and the competition counts Hardcore Worlds (the caller decides).
 */
export function PrizeCurrencyChoice({
  value,
  onChange,
  mainAvailable,
  hcwAvailable,
  disabled = false,
}: {
  value: PrizeCurrency;
  onChange: (next: PrizeCurrency) => void;
  mainAvailable: number;
  hcwAvailable: number;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground/70">Paid in</p>
      <div role="radiogroup" aria-label="Prize currency" className="flex flex-wrap gap-2">
        <Card active={value === 'gp'} disabled={disabled} onClick={() => onChange('gp')} title="Main game gp" blurb={`From the main coffer: ${formatGp(mainAvailable)} available`} />
        <Card active={value === 'hcw'} disabled={disabled} onClick={() => onChange('hcw')} title="Hardcore Worlds gp" blurb={`From the HCW coffer: ${formatGp(hcwAvailable)} available`} icon />
      </div>
    </div>
  );
}
