// Level tiers inside one guide, and the gear-progression block. PURE — no imports.
//
// ONE GUIDE COVERS A CONTENT FROM FIRST KILL TO BEST-IN-SLOT. A guide that only serves one level of
// player sends everyone else to find another, which is the thing a guide library exists to stop. So a
// guide body is split into level sections by marker lines:
//
//   ::: beginner          everything until the next marker is the Beginner section
//   ::: intermediate
//   ::: advanced
//   :::                   back to shared text (shown at every level)
//
// Text before the first marker is shared too (the intro). The site shows a level switcher; Discord,
// which can't switch, gets each level as its own headed run of messages.
//
// The GEAR BLOCK is a fenced ```gear block holding JSON (written by the editor's builder, not by
// hand): the monster and the setups per level the calculator compares a reader's gear against.

export const TIERS = [
  { key: 'beginner', label: 'Beginner', emoji: '🟢' },
  { key: 'intermediate', label: 'Intermediate', emoji: '🟡' },
  { key: 'advanced', label: 'Advanced', emoji: '🔴' },
] as const;
export type TierKey = (typeof TIERS)[number]['key'];

export const tierOf = (key: string | null | undefined) => TIERS.find((t) => t.key === key) ?? null;

const MARKER_RE = /^\s*:::\s*([a-z]*)\s*$/i;
const FENCE_RE = /^\s*```/;
const GEAR_OPEN_RE = /^\s*```\s*gear\s*$/i;

/** Categories whose library guides must cover every tier. Clan info and general notes need not. */
export function requiresTiers(category: string): boolean {
  return category !== 'clan' && category !== 'general';
}

export interface Segment {
  /** null = shared (shown at every level). */
  tier: TierKey | null;
  kind: 'text' | 'gear';
  text: string;
}

/** Split a body into shared/tiered text and gear blocks, in order. */
export function splitSegments(body: string): Segment[] {
  const out: Segment[] = [];
  let tier: TierKey | null = null;
  let buf: string[] = [];
  let inFence = false;
  let gear: string[] | null = null;

  const flush = () => {
    const text = buf.join('\n').replace(/^\n+|\s+$/g, '');
    if (text) out.push({ tier, kind: 'text', text });
    buf = [];
  };

  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    if (gear) {
      if (FENCE_RE.test(line)) {
        out.push({ tier, kind: 'gear', text: gear.join('\n') });
        gear = null;
      } else gear.push(line);
      continue;
    }
    if (!inFence && GEAR_OPEN_RE.test(line)) {
      flush();
      gear = [];
      continue;
    }
    if (FENCE_RE.test(line)) inFence = !inFence;
    const m = !inFence ? MARKER_RE.exec(line) : null;
    if (m) {
      flush();
      const key = m[1].toLowerCase();
      tier = tierOf(key)?.key ?? null;
      continue;
    }
    buf.push(line);
  }
  if (gear) out.push({ tier, kind: 'gear', text: gear.join('\n') });
  flush();
  return out;
}

// ── Gear block ───────────────────────────────────────────────────────────────────────────────

export interface GearSetup {
  tier: TierKey;
  name: string;
  /** Item id per slot. */
  gear: Record<string, number>;
  style: number;
  spell?: string | null;
  dart?: number | null;
  stats: { attack: number; strength: number; ranged: number; magic: number };
  prayer?: string | null;
  boost?: string | null;
  onTask?: boolean;
  note?: string;
}

export interface GearBlock {
  /** "Name" or "Name#Version" as in the monster dataset. */
  monster: string;
  setups: GearSetup[];
}

export function parseGearBlock(text: string): GearBlock | null {
  try {
    const j = JSON.parse(text) as Partial<GearBlock>;
    if (!j || typeof j.monster !== 'string' || !Array.isArray(j.setups)) return null;
    const setups = j.setups.filter(
      (s): s is GearSetup => !!s && typeof s === 'object' && !!tierOf((s as GearSetup).tier) && typeof (s as GearSetup).gear === 'object',
    );
    return { monster: j.monster, setups };
  } catch {
    return null;
  }
}

export function serializeGearBlock(block: GearBlock): string {
  return '```gear\n' + JSON.stringify(block) + '\n```';
}

/** Replace the first gear block in a body (or append one). */
export function upsertGearBlock(body: string, block: GearBlock): string {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((l) => GEAR_OPEN_RE.test(l));
  const fresh = serializeGearBlock(block);
  if (start === -1) return `${body.replace(/\s+$/, '')}\n\n${fresh}\n`;
  let end = start + 1;
  while (end < lines.length && !FENCE_RE.test(lines[end])) end++;
  return [...lines.slice(0, start), fresh, ...lines.slice(end + 1)].join('\n');
}

export function firstGearBlock(body: string): GearBlock | null {
  const seg = splitSegments(body).find((s) => s.kind === 'gear');
  return seg ? parseGearBlock(seg.text) : null;
}

// ── Coverage ─────────────────────────────────────────────────────────────────────────────────

export interface Coverage {
  tiers: Record<TierKey, boolean>;
  /** Present only when the guide has a gear block: which tiers have at least one setup. */
  gear: Record<TierKey, boolean> | null;
  complete: boolean;
  missing: string[];
}

export function coverage(body: string): Coverage {
  const segs = splitSegments(body);
  const tiers = Object.fromEntries(TIERS.map((t) => [t.key, segs.some((s) => s.tier === t.key && s.text.trim())])) as Record<TierKey, boolean>;
  const block = segs.find((s) => s.kind === 'gear');
  const parsed = block ? parseGearBlock(block.text) : null;
  const gear = block
    ? (Object.fromEntries(TIERS.map((t) => [t.key, !!parsed?.setups.some((s) => s.tier === t.key)])) as Record<TierKey, boolean>)
    : null;
  const missing = [
    ...TIERS.filter((t) => !tiers[t.key]).map((t) => `${t.label} section`),
    ...(gear ? TIERS.filter((t) => !gear[t.key]).map((t) => `${t.label} gear setup`) : []),
    ...(block && !parsed ? ['a valid gear block'] : []),
  ];
  return { tiers, gear, complete: missing.length === 0, missing };
}

/**
 * The body as Discord should see it: each tier opens a fresh message under its own heading, shared
 * text after `:::` does too, and gear blocks are replaced by `renderGear` (a text summary — Discord
 * can't run a calculator). Code fences are left alone.
 */
export function bodyForDiscord(body: string, renderGear: (block: GearBlock | null) => string): string {
  const parts: string[] = [];
  let current: TierKey | null | undefined; // undefined = nothing written yet
  for (const seg of splitSegments(body)) {
    const text = seg.kind === 'gear' ? renderGear(parseGearBlock(seg.text)) : seg.text;
    if (!text.trim()) continue;
    if (seg.tier !== current) {
      const t = tierOf(seg.tier);
      // A new level (or back to shared text) starts a new message; a level gets its heading.
      if (current !== undefined) parts.push('---');
      if (t) parts.push(`## ${t.emoji} ${t.label}`);
      current = seg.tier;
    }
    parts.push(text, '');
  }
  return parts.join('\n').trim();
}
