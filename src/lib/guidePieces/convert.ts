// A library guide's markdown body as pieces. PURE — scripts/convert-guides-to-pieces.ts runs it.
//
//   level sections (::: beginner …)  → the variant's `level`
//   each gear block setup            → a loadout piece (+ fallbacks from its alts, steps from its
//                                      steps, a ground-markers kit from its markers)
//   a gear block's level markers     → a ground-markers kit for that level
//   all remaining text               → plain note pieces (the text as it is, never rendered as
//                                      markdown; split at paragraphs to fit a note)
// Everything lands in the one 'tactics' section for everyone ('*'): splitting a guide into rooms
// and roles is an editor's job afterwards. Every body goes through checkBody, as any write does;
// what doesn't pass is reported, not stored.

import { sanitizeMarkers } from '../groundMarkers';
import { parseGearBlock, splitSegments, type GearSetup } from '../guideTiers';
import { BASE_ROLE, checkBody, DEFAULT_SECTION, EQUIP_SLOTS, LIMITS, type PieceKind, type Variant } from './schema';

export interface PieceDraft {
  sectionKey: string;
  roleKey: string;
  variant: Variant;
  kind: PieceKind;
  body: unknown;
  position: number;
}

export interface Conversion {
  pieces: PieceDraft[];
  skipped: { what: string; why: string }[];
}

const NOTE_MAX = LIMITS.note.max;

/** Text cut to note-sized chunks at paragraph (then line, then hard) boundaries. */
export function chunkText(text: string, max = NOTE_MAX - 50): string[] {
  const out: string[] = [];
  let cur = '';
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = '';
  };
  for (const para of text.split(/\n{2,}/)) {
    if ((cur ? cur.length + 2 : 0) + para.length <= max) {
      cur = cur ? `${cur}\n\n${para}` : para;
      continue;
    }
    push();
    if (para.length <= max) {
      cur = para;
      continue;
    }
    for (let i = 0; i < para.length; i += max) out.push(para.slice(i, i + max).trim());
  }
  push();
  return out.filter(Boolean);
}

function loadoutOf(s: GearSetup): Record<string, unknown> {
  const worn: Record<string, number> = {};
  for (const slot of EQUIP_SLOTS) {
    const id = s.gear?.[slot];
    if (typeof id === 'number' && Number.isInteger(id) && id > 0) worn[slot] = id;
  }
  const item = (i: { id: number; q?: number } | null | undefined) => (i && Number.isInteger(i.id) && i.id > 0 ? { id: i.id, ...(typeof i.q === 'number' && i.q > 1 ? { q: i.q } : {}) } : null);
  return {
    ...(s.name ? { name: String(s.name).slice(0, 80) } : {}),
    worn,
    ...(typeof s.quiver === 'number' && s.quiver > 0 ? { quiver: s.quiver } : {}),
    ...(s.inventory?.length ? { inventory: s.inventory.slice(0, 28).map(item) } : {}),
    ...(s.runePouch?.length ? { runePouch: s.runePouch.slice(0, 4).map(item).filter(Boolean) } : {}),
    ...(typeof s.spellbook === 'number' ? { spellbook: s.spellbook } : {}),
  };
}

export function convertGuideBody(bodyText: string): Conversion {
  const pieces: PieceDraft[] = [];
  const skipped: Conversion['skipped'] = [];
  let pos = 0;
  const add = (kind: PieceKind, body: unknown, variant: Variant, what: string) => {
    const r = checkBody(kind, body);
    if (!r.ok) {
      skipped.push({ what, why: r.error });
      return;
    }
    pos += 10;
    pieces.push({ sectionKey: DEFAULT_SECTION, roleKey: BASE_ROLE, variant, kind, body: r.value, position: pos });
  };

  for (const seg of splitSegments(bodyText)) {
    const variant: Variant = seg.tier ? { level: seg.tier } : {};
    if (seg.kind === 'route') {
      skipped.push({ what: 'route block', why: 'progression routes stay on the guide' });
      continue;
    }
    if (seg.kind === 'text') {
      chunkText(seg.text).forEach((text, i) => add('note', { text }, variant, `${seg.tier ?? 'shared'} text ${i + 1}`));
      continue;
    }
    const block = parseGearBlock(seg.text);
    if (!block) {
      skipped.push({ what: 'gear block', why: 'not a readable gear block' });
      continue;
    }
    for (const s of block.setups) {
      const v: Variant = { level: s.tier };
      const name = s.name || s.tier;
      add('loadout', loadoutOf(s), v, `setup "${name}"`);
      const slots: Record<string, number[]> = {};
      for (const [slot, ids] of Object.entries(s.alts ?? {})) {
        const clean = (ids ?? []).filter((x): x is number => Number.isInteger(x) && x > 0).slice(0, 10);
        if ((EQUIP_SLOTS as readonly string[]).includes(slot) && clean.length) slots[slot] = clean;
      }
      if (Object.keys(slots).length) add('fallbacks', { slots }, v, `fallbacks of "${name}"`);
      const steps = (s.steps ?? []).filter((x) => typeof x === 'string' && x.trim()).slice(0, LIMITS.listItems);
      if (steps.length) add('steps', { items: steps.map((text) => ({ text: text.slice(0, 300) })) }, v, `steps of "${name}"`);
      if (s.markers?.length) add('kit', { type: 'groundMarkers', label: `${name}`.slice(0, 80), points: sanitizeMarkers(s.markers) }, v, `markers of "${name}"`);
    }
    for (const [tier, points] of Object.entries(block.markers ?? {})) {
      if (points?.length) add('kit', { type: 'groundMarkers', points: sanitizeMarkers(points) }, { level: tier as Variant['level'] }, `${tier} markers`);
    }
  }
  return { pieces, skipped };
}
