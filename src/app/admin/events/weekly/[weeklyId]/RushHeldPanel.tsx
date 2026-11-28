import type { weeklyCompetitions } from '@/db/schema';
import { rushHeldKills } from '@/lib/itemHuntDb';

/**
 * Staff: "plugin only" kills the hiscores do not show yet, by player and target. They score once the
 * hiscores catch up (read every ~15 minutes); whatever is still ahead when the rush ends never does.
 * Nothing shows for a rush on "every kill": its kills are the hiscores' own.
 */
export default async function RushHeldPanel({ comp }: { comp: typeof weeklyCompetitions.$inferSelect }) {
  const held = await rushHeldKills(comp);
  if (held.length === 0) return null;
  return (
    <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Kills waiting on the hiscores
      </h2>
      <p className="mb-3 text-xs text-text-muted">
        The plugin reported more kills than the hiscores show, or the hiscores cannot confirm them yet (the player is not listed at that boss). The extra is held, not scored, until the hiscores catch up; anything still held when the rush ends never scores. A gap that never closes is worth a look.
      </p>
      <ul className="space-y-2 text-sm">
        {held.map((p) => (
          <li key={p.rsn}>
            <span className="font-semibold">{p.rsn}</span>
            <ul className="mt-0.5 space-y-0.5 text-xs text-text-muted">
              {p.rows.map((r) => (
                <li key={r.target}>
                  {r.target}: plugin {r.plugin.toLocaleString()}, hiscores {r.hiscores.toLocaleString()} ({(r.plugin - r.hiscores).toLocaleString()} held)
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
