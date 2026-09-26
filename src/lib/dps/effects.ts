// Custom effect rules: gear bonuses platform staff add without a code change (/staff/guides/gear).
// PURE — the engine applies them after its built-in effects, the same way on the site and the server.
//
// A rule is "when THESE conditions hold, multiply accuracy and/or damage". That covers what a new
// weapon or set usually does — "+20% vs dragons", "+10% with the full set", "+15% on task" — while
// anything stranger (extra hits, procs, scaling off a stat) still needs code, on purpose: a form
// that could express everything would be a programming language nobody reviews.

import type { AttackType } from './tables';

export type CombatKind = 'melee' | 'ranged' | 'magic';

export interface EffectRule {
  id: string;
  name: string;
  enabled: boolean;
  /** The wielded weapon is one of these (item names, case-insensitive). Empty = any weapon. */
  weapons?: string[];
  /** Every one of these is worn (a set bonus). */
  wornAll?: string[];
  /** At least one of these is worn. */
  wornAny?: string[];
  kinds?: CombatKind[];
  attackTypes?: AttackType[];
  /** The target has at least one of these attributes (dragon, demon, undead, kalphite…). */
  monsterAttributes?: string[];
  /** The target is one of these monsters (names, any version). */
  monsters?: string[];
  onTask?: boolean;
  /** Multipliers, e.g. 1.2 = +20%. 1 = unchanged. */
  accuracy: number;
  damage: number;
  note?: string;
}

export interface RuleContext {
  weapon: string;
  worn: string[];
  kind: CombatKind;
  attackType: AttackType;
  monsterName: string;
  monsterAttributes: string[];
  onTask: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();
const has = (list: string[] | undefined) => Array.isArray(list) && list.length > 0;

export function ruleApplies(rule: EffectRule, ctx: RuleContext): boolean {
  if (!rule.enabled) return false;
  const worn = new Set(ctx.worn.map(norm));
  if (has(rule.weapons) && !rule.weapons!.some((w) => norm(w) === norm(ctx.weapon))) return false;
  if (has(rule.wornAll) && !rule.wornAll!.every((w) => worn.has(norm(w)))) return false;
  if (has(rule.wornAny) && !rule.wornAny!.some((w) => worn.has(norm(w)))) return false;
  if (has(rule.kinds) && !rule.kinds!.includes(ctx.kind)) return false;
  if (has(rule.attackTypes) && !rule.attackTypes!.includes(ctx.attackType)) return false;
  if (has(rule.monsterAttributes)) {
    const attrs = new Set(ctx.monsterAttributes.map(norm));
    if (!rule.monsterAttributes!.some((a) => attrs.has(norm(a)))) return false;
  }
  if (has(rule.monsters) && !rule.monsters!.some((m) => norm(m) === norm(ctx.monsterName))) return false;
  if (rule.onTask != null && rule.onTask !== ctx.onTask) return false;
  // A rule that conditions on nothing would silently boost every loadout in every guide.
  return has(rule.weapons) || has(rule.wornAll) || has(rule.wornAny) || has(rule.monsters) || has(rule.monsterAttributes);
}

/** Clean an untrusted rule (from the staff form). Throws with a human message. */
export function sanitizeRule(raw: unknown, id: string): EffectRule {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim().slice(0, 80)).slice(0, 30) : [];
  const mult = (v: unknown, label: string) => {
    const n = Number(v ?? 1);
    if (!Number.isFinite(n) || n < 0.5 || n > 3) throw new Error(`${label} multiplier must be between 0.5 and 3 (1 = unchanged).`);
    return Math.round(n * 1000) / 1000;
  };
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 80) : '';
  if (!name) throw new Error('Give the rule a name.');
  const kinds = list(r.kinds).filter((k): k is CombatKind => k === 'melee' || k === 'ranged' || k === 'magic');
  const attackTypes = list(r.attackTypes).filter((k): k is AttackType => ['stab', 'slash', 'crush', 'ranged', 'magic'].includes(k));
  const rule: EffectRule = {
    id,
    name,
    enabled: r.enabled !== false,
    weapons: list(r.weapons),
    wornAll: list(r.wornAll),
    wornAny: list(r.wornAny),
    kinds,
    attackTypes,
    monsterAttributes: list(r.monsterAttributes).map(norm),
    monsters: list(r.monsters),
    ...(r.onTask === true || r.onTask === false ? { onTask: r.onTask } : {}),
    accuracy: mult(r.accuracy, 'Accuracy'),
    damage: mult(r.damage, 'Damage'),
    ...(typeof r.note === 'string' && r.note.trim() ? { note: r.note.trim().slice(0, 200) } : {}),
  };
  if (!(has(rule.weapons) || has(rule.wornAll) || has(rule.wornAny) || has(rule.monsters) || has(rule.monsterAttributes))) {
    throw new Error('A rule needs at least one condition on gear or on the target — otherwise it would boost every loadout.');
  }
  if (rule.accuracy === 1 && rule.damage === 1) throw new Error('The rule changes nothing: set an accuracy or damage multiplier.');
  return rule;
}
