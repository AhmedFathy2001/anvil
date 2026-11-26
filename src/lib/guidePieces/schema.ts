// The shape of every guide piece, checked strictly on write. PURE.
//
// A guide is made of small PIECES so a clan can change one and keep the rest of Anvil's:
//
//   guide → SECTION (a raid room, a boss phase; "tactics" for simple content — static, the player
//           opens one by hand, nothing ever follows the fight in game)
//         → ROLE ('*' is everyone's base; "melee", "ranged", "mage"… are layered on it)
//         → VARIANT (level / account type / team size / raid level, where they matter; {} = all)
//         → a piece of one KIND: steps, danger, loadout, fallbacks, spec, checks, technique, kit, note.
//
// Every body is validated against its kind's schema here before it is stored: unknown kinds and
// unknown fields are refused (at every depth), numbers are whole and in range, every string goes
// through lib/guidePieces/text (plain text, capped), links only reach allowlisted places and kit
// payloads are the parsed data of lib/guidePieces/kit, never a pasted blob. The parsed value — not
// the input — is what gets stored, so nothing the writer sent survives that the schema didn't name.

import { HUB_NAME, isAnvilPath, type PieceLink } from './text';
import { checkKitBody, type KitBody } from './kit';
import { EQUIP_SLOTS, fail, invItem, itemId, LIMITS, qty, s, SKILL_KEYS, type PieceItem, type Result, type Schema } from './validate';

export { EQUIP_SLOTS, LIMITS, MAX_ITEM_ID, SKILL_KEYS, itemId, invItem, s, type PieceItem, type PieceSlot, type Result, type Schema } from './validate';

/** 0 standard, 1 ancient, 2 lunar, 3 arceuus (the Inventory Setups numbering, as GearSetup.spellbook). */
const spellbook = s.int(0, 3);
const slug = (max = 40) => s.pattern(new RegExp(`^[a-z0-9](?:[a-z0-9-]{0,${max - 1}})$`), `a short lowercase key (a-z, 0-9, -), at most ${max} long`);

export const link: Schema<PieceLink> = s.tagged<PieceLink>('to', {
  anvil: ((v, p) => {
    const r = s.object({ to: s.oneOf(['anvil'] as const), path: s.pattern(/^/, 'a path'), label: s.text(LIMITS.short) }, ['label'])(v, p);
    if (!r.ok) return r;
    if (!isAnvilPath(r.value.path)) return fail(p, 'an Anvil link is a path on this site, like /guide/vorkath');
    return r;
  }) as Schema<PieceLink>,
  hub: s.object({ to: s.oneOf(['hub'] as const), plugin: s.pattern(HUB_NAME, 'a Plugin Hub plugin name, like inventory-setups'), label: s.text(LIMITS.short) }, ['label']) as Schema<PieceLink>,
});

// ── Keys: section, role, variant ─────────────────────────────────────────────────────────────

export const SECTION_KEY = /^[a-z0-9](?:[a-z0-9-]{0,39})$/;
export const ROLE_KEY = /^(?:\*|[a-z0-9](?:[a-z0-9-]{0,23}))$/;
export const BASE_ROLE = '*';
export const DEFAULT_SECTION = 'tactics';

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const ACCOUNTS = ['main', 'ironman', 'hcim', 'uim', 'gim'] as const;

const range = (min: number, max: number) =>
  ((v, p) => {
    const r = s.object({ min: s.int(min, max), max: s.int(min, max) })(v, p);
    if (r.ok && r.value.min > r.value.max) return fail(p, 'min is above max');
    return r;
  }) as Schema<{ min: number; max: number }>;

/** Which players a piece is for. Absent keys mean "any". */
export interface Variant {
  level?: (typeof LEVELS)[number];
  account?: (typeof ACCOUNTS)[number];
  teamSize?: { min: number; max: number };
  raidLevel?: { min: number; max: number };
}
export const variant: Schema<Variant> = s.object(
  { level: s.oneOf(LEVELS), account: s.oneOf(ACCOUNTS), teamSize: range(1, 100), raidLevel: range(0, 600) },
  ['level', 'account', 'teamSize', 'raidLevel'],
);

// ── The kinds ────────────────────────────────────────────────────────────────────────────────

const checkItem = s.tagged<CheckItem>('type', {
  skill: s.object({ type: s.oneOf(['skill'] as const), skill: s.oneOf(SKILL_KEYS), level: s.int(1, 99) }) as Schema<CheckItem>,
  item: s.object({ type: s.oneOf(['item'] as const), item: itemId, q: qty, label: s.text(LIMITS.short) }, ['q', 'label']) as Schema<CheckItem>,
  unlock: s.object({ type: s.oneOf(['unlock'] as const), key: slug(40), label: s.text(LIMITS.short) }) as Schema<CheckItem>,
  spellbook: s.object({ type: s.oneOf(['spellbook'] as const), book: spellbook }) as Schema<CheckItem>,
  runePouch: s.object({ type: s.oneOf(['runePouch'] as const), runes: s.array(invItem, 4) }, ['runes']) as Schema<CheckItem>,
  prayer: s.object({ type: s.oneOf(['prayer'] as const), prayer: s.pattern(/^[a-z][a-z_]{1,29}$/, 'a prayer key like rigour') }) as Schema<CheckItem>,
});
export type CheckItem =
  | { type: 'skill'; skill: (typeof SKILL_KEYS)[number]; level: number }
  | { type: 'item'; item: number; q?: number; label?: string }
  | { type: 'unlock'; key: string; label: string }
  | { type: 'spellbook'; book: number }
  | { type: 'runePouch'; runes?: PieceItem[] }
  | { type: 'prayer'; prayer: string };

const loadout = s.object(
  {
    name: s.text(LIMITS.short),
    worn: s.record(EQUIP_SLOTS, itemId),
    quiver: s.nullable(itemId),
    inventory: s.array(s.nullable(invItem), 28),
    runePouch: s.array(invItem, 4),
    spellbook,
  },
  ['name', 'quiver', 'inventory', 'runePouch', 'spellbook'],
);

export const BODY_SCHEMAS = {
  steps: s.object({ items: s.array(s.object({ text: s.text(LIMITS.line), link }, ['link']), LIMITS.listItems, 1) }),
  danger: s.object({
    items: s.array(s.object({ title: s.text(LIMITS.short), text: s.text(LIMITS.line), severity: s.oneOf(['high', 'medium', 'low'] as const) }, ['text', 'severity']), 20, 1),
  }),
  loadout,
  fallbacks: s.object(
    {
      slots: s.record(EQUIP_SLOTS, s.array(itemId, 10, 1)),
      items: s.array(s.object({ item: itemId, alts: s.array(itemId, 10, 1) }), 28),
    },
    ['slots', 'items'],
  ),
  spec: s.object({ weapons: s.array(itemId, 10, 1), note: s.text(LIMITS.line) }, ['note']),
  checks: s.object({ items: s.array(checkItem, LIMITS.listItems, 1) }),
  technique: s.object(
    {
      name: s.text(LIMITS.short),
      summary: s.text(LIMITS.line),
      changes: s.object(
        {
          supply: s.array(s.object({ item: itemId, delta: s.int(-10_000, 10_000) }), 28),
          gear: s.array(s.object({ slot: s.oneOf(EQUIP_SLOTS), item: s.nullable(itemId) }), EQUIP_SLOTS.length),
          steps: s.array(s.text(LIMITS.line), 20),
          req: s.array(checkItem, 20),
        },
        ['supply', 'gear', 'steps', 'req'],
      ),
    },
    ['summary'],
  ),
  kit: ((v, p) => checkKitBody(v, p)) as Schema<KitBody>,
  note: s.object({ text: s.text(LIMITS.note), link }, ['link']),
} satisfies Record<string, Schema<unknown>>;

export type PieceKind = keyof typeof BODY_SCHEMAS;
export const PIECE_KINDS = Object.keys(BODY_SCHEMAS) as PieceKind[];
export type PieceBody<K extends PieceKind = PieceKind> = typeof BODY_SCHEMAS[K] extends Schema<infer T> ? T : never;

/** Kinds a role or a more specific variant REPLACES (one loadout per role); the rest add up. */
export const SINGLE_KINDS: ReadonlySet<PieceKind> = new Set<PieceKind>(['loadout', 'fallbacks', 'spec']);

export const isPieceKind = (k: unknown): k is PieceKind => typeof k === 'string' && Object.prototype.hasOwnProperty.call(BODY_SCHEMAS, k);

/** A body as it may be stored, or why not. Size-capped as JSON too, whatever the schema allowed. */
export const BODY_MAX_BYTES = 64_000;
export function checkBody(kind: unknown, body: unknown): Result<PieceBody> {
  if (!isPieceKind(kind)) return { ok: false, error: 'Unknown piece kind.' };
  const r = (BODY_SCHEMAS[kind] as Schema<PieceBody>)(body, kind);
  if (!r.ok) return r;
  if (JSON.stringify(r.value).length > BODY_MAX_BYTES) return { ok: false, error: 'That piece is too big.' };
  return r;
}

// ── Write inputs ─────────────────────────────────────────────────────────────────────────────
//
// What a route may hand the store. Never a clan id, a user id, a version or a timestamp: those come
// from the session and the row. The object schemas refuse any field not named here.

const placement = { section: s.pattern(SECTION_KEY, 'a section key'), role: s.pattern(ROLE_KEY, "'*' or a role key"), variant, position: s.int(0, 10_000) };

export const anvilPieceInput = s.object(
  { guideId: s.int(1, 2_147_483_647), kind: s.oneOf(PIECE_KINDS), body: (v: unknown) => ({ ok: true, value: v }) as Result<unknown>, status: s.oneOf(['draft', 'published'] as const), ...placement },
  ['status', 'section', 'role', 'variant', 'position'],
);
export const anvilPieceEdit = s.object(
  { body: (v: unknown) => ({ ok: true, value: v }) as Result<unknown>, status: s.oneOf(['draft', 'published'] as const), ...placement },
  ['body', 'status', 'section', 'role', 'variant', 'position'],
);
/** A clan's version of one Anvil piece: a new body, or hidden. */
export const overrideInput = s.object(
  { body: (v: unknown) => ({ ok: true, value: v }) as Result<unknown>, hidden: s.bool(), position: s.nullable(s.int(0, 10_000)) },
  ['body', 'hidden', 'position'],
);
/** A piece a clan adds of its own to a library guide. */
export const clanPieceInput = s.object(
  { guideId: s.int(1, 2_147_483_647), kind: s.oneOf(PIECE_KINDS), body: (v: unknown) => ({ ok: true, value: v }) as Result<unknown>, ...placement },
  ['section', 'role', 'variant', 'position'],
);
