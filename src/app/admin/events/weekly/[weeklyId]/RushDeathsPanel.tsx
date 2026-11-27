import LocalTime from '@/components/LocalTime';
import { rushDeathShotsOf } from '@/lib/itemHuntDb';

/**
 * Staff: every death a Boss Rush took points for, by entrant, each with its screenshot (the plugin
 * sends one per counted death). Players see only their own, on the rush's page.
 */
export default async function RushDeathsPanel({ competitionId }: { competitionId: number }) {
  const byRsn = await rushDeathShotsOf(competitionId);
  const total = [...byRsn.values()].reduce((n, l) => n + l.length, 0);
  return (
    <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Deaths
        <span className="text-xs font-normal text-text-muted">{total} counted</span>
      </h2>
      <p className="mb-3 text-xs text-text-muted">Each death that cost points, with the screenshot the plugin took. Only staff and the player who died see these.</p>
      {total === 0 ? (
        <p className="text-sm text-text-muted">No deaths yet.</p>
      ) : (
        <ul className="space-y-3">
          {[...byRsn.entries()].map(([rsn, deaths]) => (
            <li key={rsn}>
              <p className="text-sm font-semibold">
                {rsn} <span className="font-normal text-text-muted">· {deaths.length}</span>
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
                {deaths.map((d) => (
                  <li key={d.at}>
                    <LocalTime date={d.at} format="short" />
                    {d.source && <> · {d.source}</>}
                    {d.url ? (
                      <> · <a href={d.url} target="_blank" rel="noreferrer" className="underline hover:text-gold">screenshot</a></>
                    ) : (
                      <> · no screenshot</>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
