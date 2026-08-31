import ClanLink from '@/components/ClanLink';
import ShareToggle from '@/components/ShareToggle';
import LinkAccountsToggle from '@/components/LinkAccountsToggle';
import AddCharacterClient from '@/app/profile/AddCharacterClient';
import AnnouncementsDrawer from '@/app/profile/AnnouncementsDrawer';
import type { MyClan } from '@/lib/myClans';
import type { EmissionSettingsView } from '@/lib/emissionSettings';

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
  linked,
  emission,
}: {
  displayName: string;
  clans: MyClan[];
  characters: PersonCharacter[];
  linked: boolean;
  /** Personal webhooks + cross-clan announcement routing — person-level, so their home is here on
      the account, not inside any one clan's locker. Null when there's no character to route yet. */
  emission?: EmissionSettingsView | null;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <span className="w-1 h-8 bg-gold rounded-full" />
        <div>
          <h1 className="text-3xl font-bold text-gold">{displayName}</h1>
          <p className="text-sm text-text-muted">
            Your account across Anvil — characters, sharing, webhooks and billing. Everything about a
            clan&rsquo;s boards lives in that clan&rsquo;s locker, linked below.
          </p>
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

                {/* THE WAY TO YOUR LOCKER, which had no way in from here at all.

                    The locker — career, live boards, trophies, milestones, the history of
                    everything you have played — is assembled per clan, so it lives at
                    /c/<slug>/profile and cannot be shown on the apex: none of it has a single
                    answer when no clan is named. But this page linked each clan to its HOME, so
                    the only route to your own locker was to walk into a clan and find Profile in
                    its nav. The richest surface in the product, reachable by accident. */}
                {c.seat && (
                  <ClanLink
                    href={`/c/${c.slug}/profile`}
                    className="mt-1.5 inline-block text-[12.5px] text-text-muted transition-colors hover:text-gold"
                  >
                    Your locker in {c.name} →
                  </ClanLink>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your characters</h2>
        {characters.length === 0 ? (
          /* This said "Connect the plugin from inside a clan to link one" — addressed to exactly the
             people who have no clan, which is the one thing they could not act on. Claiming a
             character needs no clan now (lib/accountClaim), so the answer is the form itself rather
             than a redirect to somewhere they still cannot do it.

             Manual review is off: it means "a moderator vouches for me", and on the apex there is no
             moderator to ask. */
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <p className="mb-4 text-sm text-text-muted">
              No characters linked yet — here&rsquo;s the quickest way to add your first.
            </p>
            <AddCharacterClient first />
          </div>
        ) : (
          <>
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

            {/* Adding a character is a platform act — it stays yours in every clan — so the way to do
                it lives here too, not only in the empty state or inside a clan's locker. */}
            <details className="group mt-3 rounded-xl border border-card-border bg-card-bg">
              <summary className="flex cursor-pointer list-none select-none items-center gap-2 px-4 py-3 text-sm font-semibold">
                <span className="text-text-muted transition-transform group-open:rotate-90" aria-hidden>
                  ▸
                </span>
                Add another character
              </summary>
              <div className="px-4 pb-4">
                <AddCharacterClient />
              </div>
            </details>
          </>
        )}
        <LinkAccountsToggle linked={linked} sharedCount={characters.filter((c) => c.shared).length} />
      </section>

      {/* Announcements & webhooks — where your drops, deaths and CAs post, and your own Discord
          webhooks. Person-level and cross-clan: it routes BETWEEN your clans, so it could never have
          lived on one of them. Absent only until you have a character to route. */}
      {emission && (
        <section className="mt-10">
          <h2 className="mb-1 text-lg font-semibold">Announcements &amp; webhooks</h2>
          <p className="mb-3 max-w-[70ch] text-sm text-text-muted">
            Where your social notifications go across every clan, and your own Discord destinations —
            set once here, for all of them. (Bingo submissions are separate: those always reach the
            clan running the board.)
          </p>
          <AnnouncementsDrawer initial={emission} defaultOpen />
        </section>
      )}

      {/* Billing is a platform concern too — one account, one subscription, wherever you host. */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Billing &amp; plan</h2>
        <ClanLink
          href="/portal"
          className="flex items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/40"
        >
          <span>
            <span className="block font-medium text-foreground">Manage billing &amp; your plan</span>
            <span className="mt-0.5 block text-sm text-text-muted">
              Your subscription, invoices and the tier each clan you host is on.
            </span>
          </span>
          <span className="text-gold" aria-hidden>
            →
          </span>
        </ClanLink>
      </section>
    </div>
  );
}
