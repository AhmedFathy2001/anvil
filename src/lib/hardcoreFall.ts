/**
 * A death on Hardcore Worlds (lib/worldModes key 'hardcore', the HARDCORE_MAIN world flag) ends that
 * character for good: the save starts over. So it isn't an ordinary death. It gets its own post, its
 * own feed line, and it is the one thing from that world the clan feed keeps.
 *
 * Everything else from a Hardcore World is another save's progress and stays out (lib/worldModeRequest).
 * The death is stored against the clan only — never a board or a week — so it can't count as a death
 * on a main-game event. A fallen death is a 'death' moment whose `tier` is the mode key: `tier` is
 * otherwise empty on a death (it carries combat-task and diary tiers), so no migration is needed and
 * every existing death read — Sad / Sit reactions, the Deaths filter, "keep deaths" — still applies.
 */
export const FALLEN_MODE = 'hardcore';

export function isFallenDeath(m: { kind: string; tier?: string | null }): boolean {
  return m.kind === 'death' && m.tier === FALLEN_MODE;
}

/** The feed's sentence for it, after the name ("Drenvox fell on Hardcore Worlds to Vorkath"). */
export function fallenSentence(source: string | null): string {
  return source ? `fell on Hardcore Worlds to ${source}` : 'fell on Hardcore Worlds';
}

/** The panel feed's title for it. */
export function fallenTitle(source: string | null): string {
  return source ? `Fell on Hardcore Worlds to ${source}` : 'Fell on Hardcore Worlds';
}

/**
 * Only the deaths out of a push from a Hardcore World, each marked as fallen. A plain object per
 * moment (the route validates the fields after this), anything else dropped.
 */
export function fallenMoments(raw: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const o = m as Record<string, unknown>;
    if (o.kind !== 'death') continue;
    out.push({ ...o, tier: FALLEN_MODE });
  }
  return out;
}

/** Near-black: a fallen post reads apart from the red of an ordinary death. */
export const FALLEN_COLOR = 0x2c2f33;

/**
 * The Discord embed for it: the death embed the post already has, retitled and recoloured, with a
 * line that says what happened. The mode stamp ("[Hardcore]") is added after, as on any mode post.
 */
export function fallenEmbed(embed: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!embed) return embed;
  const said = typeof embed.description === 'string' ? embed.description.trim() : '';
  const line = 'Their Hardcore Worlds character is gone. The save starts over.';
  return {
    ...embed,
    title: '🪦 Fallen',
    color: FALLEN_COLOR,
    description: said ? `${said}\n\n${line}`.slice(0, 4096) : line,
  };
}
