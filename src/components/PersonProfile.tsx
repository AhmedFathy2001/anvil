import ClanLink from '@/components/ClanLink';
import ShareToggle from '@/components/ShareToggle';
import type { MyClan } from '@/lib/myClans';

export interface PersonCharacter {
  id: number;
  rsn: string;
  shared: boolean;
}

/**
 * You, across the platform — the page `/profile` shows on the apex.
 *
 * It exists because the identity model says a human owns their profile and it follows them between
 * clans, while the code said a profile belongs to a clan: `/profile` called requireClan() and so
 * returned 404 on the apex, where a person has no clan. A signed-in member clicking their own name
 * in the header got a not-found page, which is a strange thing for a platform to say about you.
 *
 * The clan-scoped locker is a different surface and stays where it is. This one deliberately holds
 * only what is true of the PERSON regardless of clan: which clans they are in, which characters they
 * play, and which of those they have chosen to publish. Anything about a board or a team belongs to
 * the clan it happened in, and is linked to rather than merged — a merge across clans would describe
 * nobody.
 */
export default function PersonProfile({
  displayName,
  clans,
  characters,
}: {
  displayName: string;
  clans: MyClan[];
  characters: PersonCharacter[];
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <span className="w-1 h-8 bg-gold rounded-full" />
        <div>
          <h1 className="text-3xl font-bold text-gold">{displayName}</h1>
          <p className="text-sm text-text-muted">Your account across Anvil.</p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Your clans</h2>
        {clans.length === 0 ? (
          <p className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-text-muted">
            You&rsquo;re not in a clan yet.{' '}
            <ClanLink href="/clans" className="text-gold hover:text-gold-light">
              Browse the clans on Anvil
            </ClanLink>
            .
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {clans.map((c) => (
              <li key={c.id}>
                <ClanLink
                  href={`/c/${c.slug}`}
                  className="block rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/40"
                >
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="mt-1 flex gap-2 text-xs text-text-muted">
                    {/* Guest and member are genuinely different standings, and someone who has been
                        demoted by joining elsewhere should be able to see that here rather than
                        discover it when something stops working. */}
                    {c.seat === 'member' && <span className="text-gold">Member</span>}
                    {c.seat === 'guest' && <span>Guest</span>}
                    {!c.seat && <span>No roster seat</span>}
                    {c.staff && <span className="text-gold/70">· Staff</span>}
                  </span>
                </ClanLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your characters</h2>
        {characters.length === 0 ? (
          <p className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-text-muted">
            No characters linked yet. Connect the plugin from inside a clan to link one.
          </p>
        ) : (
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {characters.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <ClanLink
                  href={`/p/${encodeURIComponent(a.rsn)}`}
                  className="text-sm hover:text-gold"
                >
                  {a.rsn}
                </ClanLink>
                {/* Sharing is per character, not per person, so "my main is public and my ironman is
                    nobody's business" is a thing you can actually say — and it is settable HERE,
                    because it is the one thing a person says to clans they are not in. It used to be
                    reachable only inside the clan locker, and the result was that nobody on the
                    platform had ever set it: /u/, /p/ and the leaderboard's Players table were dark. */}
                <ShareToggle accountId={a.id} shared={a.shared} rsn={a.rsn} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
