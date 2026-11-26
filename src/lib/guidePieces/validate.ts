// The strict validator behind guide pieces (lib/guidePieces/schema, kit). PURE.

import { checkText, type TextRule } from './text';

// ── A tiny strict validator ──────────────────────────────────────────────────────────────────
//
// The repo validates by hand; this is that, made uniform. A Schema<T> takes unknown and returns
// the value it vouches for, or the first problem with where it was.

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type Schema<T> = (v: unknown, path: string) => Result<T>;

export const fail = (path: string, msg: string): { ok: false; error: string } => ({ ok: false, error: path ? `${path}: ${msg}` : msg });
export const isPlain = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

export const s = {
  text(rule: TextRule): Schema<string> {
    return (v, path) => {
      const r = checkText(v, rule, path || 'Text');
      return r.ok ? { ok: true, value: r.text } : { ok: false, error: r.error };
    };
  },
  int(min: number, max: number): Schema<number> {
    return (v, path) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? { ok: true, value: v } : fail(path, `must be a whole number from ${min} to ${max}`));
  },
  bool(): Schema<boolean> {
    return (v, path) => (typeof v === 'boolean' ? { ok: true, value: v } : fail(path, 'must be true or false'));
  },
  oneOf<T extends string>(values: readonly T[]): Schema<T> {
    return (v, path) => (typeof v === 'string' && (values as readonly string[]).includes(v) ? { ok: true, value: v as T } : fail(path, `must be one of ${values.join(', ')}`));
  },
  pattern(re: RegExp, what: string): Schema<string> {
    return (v, path) => (typeof v === 'string' && re.test(v) ? { ok: true, value: v } : fail(path, `must be ${what}`));
  },
  array<T>(of: Schema<T>, max: number, min = 0): Schema<T[]> {
    return (v, path) => {
      if (!Array.isArray(v)) return fail(path, 'must be a list');
      if (v.length > max) return fail(path, `holds at most ${max}`);
      if (v.length < min) return fail(path, `needs at least ${min}`);
      const out: T[] = [];
      for (let i = 0; i < v.length; i++) {
        const r = of(v[i], `${path}[${i}]`);
        if (!r.ok) return r;
        out.push(r.value);
      }
      return { ok: true, value: out };
    };
  },
  nullable<T>(of: Schema<T>): Schema<T | null> {
    return (v, path) => (v === null ? { ok: true, value: null } : of(v, path));
  },
  /**
   * An object with exactly these keys (the optional ones may be absent). Any other key is refused,
   * which is what keeps a "clanId" or a "__proto__" from riding along in a body.
   */
  object<S extends Record<string, Schema<unknown>>, O extends keyof S = never>(shape: S, optional: readonly O[] = []) {
    type Out = { [K in Exclude<keyof S, O>]: S[K] extends Schema<infer T> ? T : never } & { [K in O]?: S[K] extends Schema<infer T> ? T : never };
    return ((v: unknown, path: string): Result<Out> => {
      if (!isPlain(v)) return fail(path, 'must be an object');
      for (const k of Object.keys(v)) if (!Object.prototype.hasOwnProperty.call(shape, k)) return fail(path, `unknown field "${k.slice(0, 40)}"`);
      const out: Record<string, unknown> = {};
      for (const [k, sch] of Object.entries(shape)) {
        const has = Object.prototype.hasOwnProperty.call(v, k) && v[k] !== undefined;
        if (!has) {
          if ((optional as readonly string[]).includes(k)) continue;
          return fail(path ? `${path}.${k}` : k, 'is missing');
        }
        const r = sch(v[k], path ? `${path}.${k}` : k);
        if (!r.ok) return r;
        out[k] = r.value;
      }
      return { ok: true, value: out as Out };
    }) as Schema<Out>;
  },
  /** A record whose keys come from a fixed list. */
  record<K extends string, T>(keys: readonly K[], of: Schema<T>, max = keys.length): Schema<Partial<Record<K, T>>> {
    return (v, path) => {
      if (!isPlain(v)) return fail(path, 'must be an object');
      const ks = Object.keys(v);
      if (ks.length > max) return fail(path, `holds at most ${max}`);
      const out: Partial<Record<K, T>> = {};
      for (const k of ks) {
        if (!(keys as readonly string[]).includes(k)) return fail(path, `unknown key "${k.slice(0, 40)}"`);
        const r = of(v[k], `${path}.${k}`);
        if (!r.ok) return r;
        out[k as K] = r.value;
      }
      return { ok: true, value: out };
    };
  },
  /** One of several object shapes, picked by a string field. */
  tagged<T>(field: string, cases: Record<string, Schema<T>>): Schema<T> {
    return (v, path) => {
      if (!isPlain(v)) return fail(path, 'must be an object');
      const tag = v[field];
      if (typeof tag !== 'string' || !Object.prototype.hasOwnProperty.call(cases, tag)) return fail(path, `${field} must be one of ${Object.keys(cases).join(', ')}`);
      return cases[tag](v, path);
    };
  },
};

// ── Shared parts ─────────────────────────────────────────────────────────────────────────────

export const LIMITS = {
  short: { max: 80 } as TextRule,
  line: { max: 300 } as TextRule,
  note: { max: 2000, multiline: true } as TextRule,
  listItems: 40,
};

export const MAX_ITEM_ID = 100_000;
export const itemId = s.int(1, MAX_ITEM_ID);
export const qty = s.int(1, 2_147_483_647);
export const invItem = s.object({ id: itemId, q: qty }, ['q']);
export type PieceItem = { id: number; q?: number };

export const EQUIP_SLOTS = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'] as const;
export type PieceSlot = (typeof EQUIP_SLOTS)[number];

export const SKILL_KEYS = [
  'attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking',
  'crafting', 'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecraft', 'hunter', 'construction', 'sailing',
] as const;

