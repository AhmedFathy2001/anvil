/**
 * Spread unassigned players over teams so team sizes end up as even as they can: each player goes to
 * the team that currently has the fewest, ties to the earlier team. Returns the `assignments` array
 * the weekly teams route takes. Pure, so the order and balance are testable.
 */
export function splitUnassigned(
  teamIds: number[],
  participants: { id: number; teamId: number | null }[],
): { participantId: number; teamId: number }[] {
  if (teamIds.length === 0) return [];
  const size = new Map<number, number>(teamIds.map((t) => [t, 0]));
  for (const p of participants) if (p.teamId != null && size.has(p.teamId)) size.set(p.teamId, size.get(p.teamId)! + 1);
  const out: { participantId: number; teamId: number }[] = [];
  for (const p of participants) {
    if (p.teamId != null) continue;
    let best = teamIds[0];
    for (const t of teamIds) if (size.get(t)! < size.get(best)!) best = t;
    size.set(best, size.get(best)! + 1);
    out.push({ participantId: p.id, teamId: best });
  }
  return out;
}
