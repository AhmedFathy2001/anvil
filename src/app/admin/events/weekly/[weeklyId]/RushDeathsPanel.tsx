import LocalTime from '@/components/LocalTime';
import { rushDeathShotsOf, rushKillProofsOf } from '@/lib/itemHuntDb';

/**
 * Staff: every death a Boss Rush took points for, by entrant, each with its screenshot (the plugin
 * sends one per counted death). Players see only their own, on the rush's page.
 */
export default async function RushDeathsPanel({ competitionId }: { competitionId: number }) {
  const [byRsn, proofs] = await Promise.all([rushDeathShotsOf(competitionId), rushKillProofsOf(competitionId)]);
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
                {rsn} <span className="font-normal text-text-muted">({deaths.length})</span>
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
                {deaths.map((d) => (
                  <li key={d.at}>
                    <LocalTime date={d.at} format="short" />
                    {d.source && <>, {d.source}</>}
                    {d.url ? (
                      <>, <a href={d.url} target="_blank" rel="noreferrer" className="underline hover:text-gold">screenshot</a></>
                    ) : (
                      <>, no screenshot</>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {proofs.size > 0 && (
        <div className="mt-5">
          <p className="mb-1 text-sm font-semibold">Kill proofs</p>
          <p className="mb-2 text-xs text-text-muted">For targets the hiscores do not track, the plugin screenshots the 1st kill and every 25th. A count far past its last proof is worth a look.</p>
          <ul className="space-y-2 text-xs text-text-muted">
            {[...proofs.entries()].map(([rsn, list]) => (
              <li key={rsn}>
                <span className="text-sm font-semibold text-foreground">{rsn}</span>
                <ul className="mt-0.5 space-y-0.5">
                  {list.map((k) => (
                    <li key={`${k.target}-${k.n}`}>
                      {k.target}, kill {k.n.toLocaleString()}, <LocalTime date={k.at} format="short" />
                      {k.url ? (
                        <>, <a href={k.url} target="_blank" rel="noreferrer" className="underline hover:text-gold">screenshot</a></>
                      ) : (
                        <>, no screenshot</>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
