import { assessLuckAt, chancePerKill } from '@/lib/clogLuck';
import { kcLabel } from '@/lib/displayCaseStats';
import { expectationFor, type LuckRateSource } from '@/lib/clogProfile';

// The luck line under a display-case pin: how the drop went against its wiki rate. Pure — the caller
// hands in the candidate list (lib/clogLuckBoard luckCandidates) and the player's current kill counts.
// Never shaming: spooned is green, everything else is plain muted text.

export interface PinLuck {
  text: string;
  tone: 'green' | 'muted';
}

export interface PinLuckInput {
  itemId: number;
  source: string | null;
  /** KC at the moment the item dropped or unlocked, when known. */
  kc?: number | null;
  /** How many they own. */
  qty?: number | null;
}

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

export function pinLuck(
  p: PinLuckInput,
  candidates: { itemId: number; sources: LuckRateSource[] }[],
  _kcNow: (bossKey: string) => number,
): PinLuck | null {
  const sources = candidates.find((c) => c.itemId === p.itemId)?.sources ?? [];
  const want = (p.source ?? '').trim().toLowerCase();
  const src = sources.find((s) => s.source.toLowerCase() === want) ?? sources[0];
  if (!src || !(src.denominator > 0)) return null;
  const rate = `1/${n(src.denominator)}`;
  if (p.kc && p.kc > 0) {
    const a = assessLuckAt(chancePerKill(src.denominator, src.rolls) * p.kc, p.kc, 1);
    if (a.verdict === 'spooned') return { text: `Spooned · ${n(p.kc)} KC (${rate})`, tone: 'green' };
    if (a.verdict === 'dry') return { text: `Dry · ${n(p.kc)} KC (${rate})`, tone: 'muted' };
    return { text: `${n(p.kc)} KC · on rate`, tone: 'muted' };
  }
  // Only the KC it actually dropped at is shown: no stand-in from today's kill count (it would read
  // as the drop KC). Without one the pin falls back to ×N owned, the month, or the name.
  return null;
}
