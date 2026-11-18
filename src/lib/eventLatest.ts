import { momentSentence } from '@/lib/moments';

/**
 * The Board tab's one short "Latest" strip: finished tiles and the board's moments (drops, deaths,
 * milestones) in one list, newest first. The long lists live on Feed & chat; this is the glance.
 *
 * Pure: the page hands it rows it has already filtered for this viewer (the curtain, hidden race
 * tiles), so nothing here decides what somebody may see.
 */

export type LatestTag = 'tile' | 'step' | 'drop' | 'pet' | 'death' | 'log' | 'milestone';

export interface LatestLine {
  key: string;
  tag: LatestTag;
  who: string;
  text: string;
  detail: string | null;
  at: string | null;
}

export interface LatestFinish {
  id: number | string;
  who: string;
  /** "Any Raids Unique" */
  label: string;
  /** "step 3 of 8 · road A" on a race; null on other boards. */
  where: string | null;
  at: string | null;
}

export interface LatestMoment {
  id: number;
  rsn: string;
  kind: string;
  itemName: string | null;
  quantity: number;
  source: string | null;
  sourceKind?: string | null;
  valueGp: number | null;
  tier?: string | null;
  kc: number | null;
  rarityDenominator: number | null;
  occurredAt: string;
  run?: { n: number; mixed?: boolean } | null;
}

const MOMENT_TAG: Record<string, LatestTag> = { pet: 'pet', unique: 'drop', loot: 'drop', death: 'death', clog: 'log' };

export function latestTagOf(kind: string): LatestTag {
  return MOMENT_TAG[kind] ?? 'milestone';
}

function momentDetail(m: LatestMoment): string | null {
  const bits: string[] = [];
  if (m.rarityDenominator && m.rarityDenominator >= 100) bits.push(`1 in ${m.rarityDenominator.toLocaleString()}`);
  if (m.kc && m.kc > 0 && m.kind !== 'death') bits.push(`${m.kc.toLocaleString()} KC`);
  return bits.length > 0 ? bits.join(' · ') : null;
}

const ms = (at: string | null) => (at ? Date.parse(at.includes('T') ? at : `${at.replace(' ', 'T')}Z`) || 0 : 0);

export function buildEventLatest(input: { finishes: LatestFinish[]; moments: LatestMoment[]; race: boolean; limit?: number }): LatestLine[] {
  const lines: LatestLine[] = [
    ...input.finishes.map((f) => ({
      key: `f${f.id}`,
      tag: (input.race ? 'step' : 'tile') as LatestTag,
      who: f.who,
      text: `finished ${f.label}`,
      detail: f.where,
      at: f.at,
    })),
    ...input.moments.map((m) => ({
      key: `m${m.id}`,
      tag: latestTagOf(m.kind),
      who: m.rsn,
      text: momentSentence(m),
      detail: momentDetail(m),
      at: m.occurredAt,
    })),
  ];
  return lines.sort((a, b) => ms(b.at) - ms(a.at)).slice(0, input.limit ?? 5);
}
