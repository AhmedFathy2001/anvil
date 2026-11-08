// Replay scenarios for the plugin's dev-client test harness (lib/lab, `::anvil sync`).
//
// THE FORMAT IS THE HARNESS'S. It lives in the plugin at src/test/resources/scenarios/README.md and
// is mirrored here only far enough to refuse what the harness would skip on load — so a scenario
// saved on /staff/lab is one the dev client will actually run. The harness re-validates everything
// (item and varbit names, ChatMessageType names) against the game's own tables, which we cannot.

/** Becomes a file name on the dev machine. */
export const SCENARIO_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const STEP_KEYS = new Set([
  'wait', 'chat', 'loot', 'varbit', 'varp', 'restore', 'stat', 'death', 'pvpKill', 'attacked', 'playerSpawn', 'playerLoot',
]);
const LOOT_KINDS = new Set(['npc', 'server', 'generic']);
const MAX_STEPS = 500;

/** A JSON number, or a string (a `${placeholder}`, or "1,999"). */
function isIntLike(v: unknown): boolean {
  return (typeof v === 'number' && Number.isInteger(v)) || (typeof v === 'string' && v.trim() !== '');
}

function checkItems(at: string, what: string, items: unknown): string | null {
  if (!Array.isArray(items)) return `${at} ${what} needs an items list.`;
  for (const it of items as Record<string, unknown>[]) {
    if (!it || (it.id == null && typeof it.name !== 'string')) return `${at} each item needs an id or a name.`;
  }
  return null;
}

function checkStep(step: unknown, i: number): string | null {
  const at = `Step ${i + 1}:`;
  if (!step || typeof step !== 'object' || Array.isArray(step)) return `${at} must be an object.`;
  const keys = Object.keys(step);
  if (keys.length !== 1) return `${at} needs exactly one key, has ${keys.length}.`;
  const [kind] = keys;
  if (!STEP_KEYS.has(kind)) return `${at} unknown step "${kind}".`;
  const body = (step as Record<string, unknown>)[kind];
  const obj = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  switch (kind) {
    case 'wait':
      return isIntLike(body) && (typeof body !== 'number' || body >= 1) ? null : `${at} wait needs ticks ≥ 1.`;
    case 'chat':
      return typeof obj.message === 'string' ? null : `${at} chat needs a message.`;
    case 'loot':
      if (!LOOT_KINDS.has(obj.kind as string)) return `${at} loot kind must be npc, server or generic.`;
      if (typeof obj.name !== 'string') return `${at} loot needs a name.`;
      return checkItems(at, 'loot', obj.items);
    case 'varbit':
    case 'varp':
      // `add` is relative to the var's current value (or to the `base` var's); `value` is absolute.
      if (obj.id == null && typeof obj.name !== 'string') return `${at} ${kind} needs an id or a name.`;
      return isIntLike(obj.value) || isIntLike(obj.add) ? null : `${at} ${kind} needs a value or an add.`;
    case 'restore':
      return body && typeof body === 'object' && !Array.isArray(body) ? null : `${at} restore takes {}.`;
    case 'stat':
      if (typeof obj.skill !== 'string') return `${at} stat needs a skill.`;
      return isIntLike(obj.addXp) || (isIntLike(obj.xp) && isIntLike(obj.level)) ? null : `${at} stat needs xp and level, or addXp.`;
    case 'death':
      if (obj.who === 'self') return null;
      return (obj.who === 'npc' || obj.who === 'player') && typeof obj.name === 'string'
        ? null
        : `${at} death is {who:"self"}, {who:"npc", name} or {who:"player", name}.`;
    case 'pvpKill':
      return typeof obj.victim === 'string' ? null : `${at} pvpKill needs a victim.`;
    case 'playerLoot':
      if (typeof obj.victim !== 'string') return `${at} playerLoot needs a victim.`;
      return checkItems(at, 'playerLoot', obj.items);
    case 'attacked':
      return typeof obj.by === 'string' ? null : `${at} attacked needs who it was by.`;
    case 'playerSpawn':
      return typeof obj.name === 'string' ? null : `${at} playerSpawn needs a name.`;
  }
  return null;
}

/** Problems that would make the harness skip this scenario. Empty = fine. */
export function checkScenario(name: string, steps: unknown, params?: unknown): string[] {
  const problems: string[] = [];
  if (!SCENARIO_NAME_RE.test(name)) problems.push('Name must be lowercase letters, digits and dashes (it becomes a file name).');
  if (params != null && (typeof params !== 'object' || Array.isArray(params) || Object.values(params).some((v) => typeof v !== 'string'))) {
    problems.push('Params must be an object of string defaults.');
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    problems.push('Steps must be a non-empty list.');
    return problems;
  }
  if (steps.length > MAX_STEPS) problems.push(`At most ${MAX_STEPS} steps.`);
  steps.forEach((s, i) => {
    const p = checkStep(s, i);
    if (p) problems.push(p);
  });
  return problems;
}
