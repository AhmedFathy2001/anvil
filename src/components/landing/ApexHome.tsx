import AnvilMark from '@/components/AnvilMark';
import ClanCrest from '@/components/ClanCrest';
import ClanLink from '@/components/ClanLink';
import type { ApexHomeView, ClanCard } from '@/lib/apexHome';
import type { ApexSignals } from '@/lib/apexHomeSignals';
import type { FoundSeat } from '@/lib/foundYou';
import { ArenaHero, CareerWell, Label, Lately, Roster, Standing, StreakBadge } from '@/components/home/ApexSignals';

/**
 * The apex, to somebody signed in.
 *
 * IT ANSWERS ONE QUESTION: what wants me right now, across everywhere I play. Nothing on this page
 * is here because it is nice to know — a clan you belong to where nothing is happening and nothing
 * is owed does not appear at all. That is deliberate, and it is why the page is short.
 *
 * BUILT FOR A DOZEN CLANS, not three. Guesting into other clans' events is meant to be normal — a
 * player who likes a challenge ends up a guest in ten of them — so a card per clan stops working
 * almost immediately: ten identical tiles saying "nothing running" is a wall, and the one clan that
 * matters is lost in it. Everything below is ordered by what is happening rather than by what you
 * belong to, and that ordering holds at three clans and at thirty.
 *
 * THE CLAN LIST IS NOT HERE ANY MORE. It is in the rail, permanently, on every page — printing it
 * again underneath was the page's largest block and its least useful, because "which clans am I in"
 * is the one question you never need this page to answer.
 *
 * WHAT REPLACED IT is the pair of things no clan surface can show you: sign-ups open across all of
 * them, and your characters side by side. A clan sees the accounts that hold a seat with it; only
 * here does "you" mean the person.
 */
export default function ApexHome({
  view,
  signals,
  displayName,
  found = [],
}: {
  view: ApexHomeView;
  signals: ApexSignals;
  displayName: string;
  /** Roster seats that name-match this login's Discord and nobody has claimed. See lib/foundYou. */
  found?: FoundSeat[];
}) {
  // The arena already IS one of these, in full. Listing it again three inches below was the page
  // saying the same thing twice, which is exactly the flatness the redesign was for.
  const arenaId = signals.arena?.competitionId ?? null;
  const clansWithOtherLive = view.clans
    .map((c) => ({ ...c, live: c.live.filter((l) => !(l.kind === 'weekly' && l.id === arenaId)) }))
    .filter((c) => c.live.length > 0);

  const live = clansWithOtherLive;
  const needsYou = view.clans.filter((c) => c.staff && c.live.length === 0);
  const running = live.reduce((n, c) => n + c.live.length, 0);
  const quiet =
    running === 0 && needsYou.length === 0 && view.openSignups.length === 0 && view.clans.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="relative mb-9 overflow-hidden">
        <AnvilMark
          size={190}
          className="pointer-events-none absolute -top-10 right-0 hidden text-gold/[0.04] sm:block"
        />
        {/* Deliberately small. When something is live the ARENA is the headline, and a greeting
            competing with it would only split the reader's attention two ways. */}
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display text-[clamp(1.25rem,3vw,1.5rem)] font-medium">
              {greeting()}, {displayName}
            </h1>
            <p className="mt-1 text-[13.5px] text-text-dim">
              {summary(view.clans.length, running, view.openSignups.length)}
            </p>
          </div>
          <StreakBadge streak={signals.streak} />
        </div>
      </header>

      {view.clans.length === 0 ? (
        // NOT a dead end. This used to be one card — "you're not in a clan yet" and two buttons —
        // which threw away everything we know about the person reading it. They have characters,
        // those characters have a week and a career, and none of that needs a clan to be worth
        // looking at. So the personal half of this page renders either way, and the clan doors sit
        // under it as an invitation rather than as the entire page.
        <div className="flex flex-col gap-10">
          {found.length > 0 && (
            <div>
              <Label>We think we found you</Label>
              <FoundSeats seats={found} />
            </div>
          )}

          <Empty hasCharacters={view.characters.length > 0} />

          {view.characters.length > 0 && (
            <div>
              <Label
                action={
                  <ClanLink href="/profile" className="whitespace-nowrap text-[13px] text-gold-dark hover:text-gold">
                    Manage characters →
                  </ClanLink>
                }
              >
                Your roster
              </Label>
              <Roster
                characters={view.characters.map((ch) => ({
                  id: ch.id,
                  rsn: ch.rsn,
                  xpThisWeek: ch.xpThisWeek,
                  seats: signals.seats.get(ch.id) ?? [],
                  next: signals.next.get(ch.id),
                }))}
              />
            </div>
          )}

          {signals.career && (
            <div>
              <Label>Career · so far</Label>
              <CareerWell career={signals.career} />
            </div>
          )}

          {signals.milestones.length > 0 && (
            <div>
              <Label>Lately</Label>
              <Lately milestones={signals.milestones} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {signals.arena && <ArenaHero arena={signals.arena} />}

          {/* Directly under the arena when there is one, and leading when there is not — between
              events this is the only thing on the page that is still a contest. */}
          {signals.standing && <Standing standing={signals.standing} />}

          {live.length > 0 && (
            <Section title="Happening now" note={`${running} running`}>
              <div className="flex flex-col gap-2.5">
                {live.flatMap((c) =>
                  c.live.map((l) => (
                    <ClanLink
                      key={`${c.id}-${l.kind}-${l.id}`}
                      href={l.kind === 'weekly' ? `/c/${c.slug}/weekly/${l.id}` : `/c/${c.slug}/events/${l.id}`}
                      className="flex items-center gap-3.5 rounded-xl border border-card-border bg-card-bg px-4 py-3.5 transition-colors hover:border-gold/40 hover:bg-card-bg-hover sm:px-5"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-accent-green-light shadow-[0_0_0_3px_rgba(52,208,88,0.14)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{l.name}</span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-text-muted">
                          {c.name} · {seatWord(c)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-dim">
                        {l.kind === 'weekly' ? 'week' : 'event'}
                      </span>
                    </ClanLink>
                  )),
                )}
              </div>
            </Section>
          )}

          {/* The reason to open this page rather than a clan's. Sign-ups shut whether or not you
              were watching, and the one you miss is always in the clan you rarely open. */}
          {view.openSignups.length > 0 && (
            <Section title="Taking entries" note={`${view.openSignups.length}`}>
              <div className="flex flex-col gap-2.5">
                {view.openSignups.map((s) => (
                  <ClanLink
                    key={s.eventId}
                    href={`/c/${s.clanSlug}/events/${s.eventId}`}
                    className="flex items-center gap-3.5 rounded-xl border border-card-border bg-card-bg px-4 py-3.5 transition-colors hover:border-gold/40 hover:bg-card-bg-hover sm:px-5"
                  >
                    <ClanCrest name={s.clanName} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{s.name}</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-text-muted">
                        {s.clanName} · {closes(s.deadline, s.startDate)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md border border-gold-dark px-2.5 py-1 text-[12.5px] text-gold">
                      Sign up
                    </span>
                  </ClanLink>
                ))}
              </div>
            </Section>
          )}

          {needsYou.length > 0 && (
            <Section title="Waiting on you" note={`${needsYou.length}`}>
              <div className="flex flex-col gap-2.5">
                {needsYou.map((c) => (
                  <ClanLink
                    key={c.id}
                    href={`/c/${c.slug}/admin/dashboard`}
                    className="flex items-center gap-3.5 rounded-xl border border-gold-dark bg-gold/[0.06] px-4 py-3.5 transition-colors hover:bg-gold/[0.1] sm:px-5"
                  >
                    <ClanCrest name={c.name} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{c.name}</span>
                      <span className="mt-0.5 block text-[12.5px] text-text-muted">
                        Nothing running — start something
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] text-gold">Open →</span>
                  </ClanLink>
                ))}
              </div>
            </Section>
          )}

          {quiet && (
            <div className="rounded-xl border border-card-border bg-card-bg px-5 py-6 text-[14.5px] text-text-muted">
              Nothing is running and nothing needs you. Your characters are still being tracked —
              whatever you play this week counts toward the next one.
            </div>
          )}

          {/* PERSON, ACCOUNT, SEAT — the model, made visible. Every clan surface shows one character
              at a time because that is all a clan may see; this is the only page where they sit
              together, with every clan each of them plays in. */}
          {view.characters.length > 0 && (
            <div>
              <Label
                action={
                  <ClanLink href="/profile" className="whitespace-nowrap text-[13px] text-gold-dark hover:text-gold">
                    Manage characters →
                  </ClanLink>
                }
              >
                Your roster
              </Label>
              <Roster
                characters={view.characters.map((ch) => ({
                  id: ch.id,
                  rsn: ch.rsn,
                  xpThisWeek: ch.xpThisWeek,
                  seats: signals.seats.get(ch.id) ?? [],
                  next: signals.next.get(ch.id),
                }))}
              />
            </div>
          )}

          {/* Not about this week at all — which is why it sits on its own plane. It is also the one
              thing a single-clan site structurally cannot show. */}
          {signals.career && (
            <div>
              <Label>Career · {signals.career.clanNames.length > 1 ? 'every clan' : 'so far'}</Label>
              <CareerWell career={signals.career} />
            </div>
          )}

          {signals.milestones.length > 0 && (
            <div>
              <Label>Lately</Label>
              <Lately milestones={signals.milestones} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  note,
  more,
  children,
}: {
  title: string;
  note?: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3.5 flex items-center gap-3">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        {/* SANS, not the serif. These are UI labels at 19px — the serif belongs to the headline and
            to the landing's editorial headings, and pressed into a small repeated label it reads as
            texture rather than as a word you can scan. */}
        <h2 className="text-[16.5px] font-semibold tracking-[-0.005em]">{title}</h2>
        {note && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-dim">
            {note}
          </span>
        )}
        {more && (
          <ClanLink href={more.href} className="ml-auto text-[13px] text-text-muted hover:text-gold">
            {more.label} →
          </ClanLink>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * The clan doors, for somebody in none.
 *
 * Reads differently depending on whether we are tracking anything of theirs yet, because the two
 * readers want opposite things. With characters linked the page above is already useful and a clan
 * is an addition; with none, connecting one IS the next step and a clan can wait.
 */
function Empty({ hasCharacters }: { hasCharacters: boolean }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-7 sm:p-8">
      <h2 className="display text-xl font-semibold">
        {hasCharacters ? 'Not in a clan yet' : 'Let’s find your account'}
      </h2>
      <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-text-muted">
        {hasCharacters
          ? 'Your characters are tracked either way — the week above is yours, clan or no clan. Join one that’s recruiting, or start your own; a clan takes an evening to set up.'
          : 'Connect a character and Anvil starts tracking its XP, kills, collection log and milestones — no clan required. Join one when you want the events.'}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <ClanLink
          href="/clans"
          className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Enter the Clan Hall
        </ClanLink>
        <ClanLink
          href="/clans/new"
          className="rounded-lg border border-card-border px-4 py-2.5 text-sm transition-colors hover:border-gold-dark"
        >
          Start one
        </ClanLink>
      </div>
      {/* The same two doors the setup flow's clan step offers, so this is not a third option — it is
          the option for somebody who would rather be walked through the whole thing than decide what
          to press. Quiet, because most people will just pick one of the buttons above. */}
      <p className="mt-4 text-[13px] text-text-dim">
        Or{' '}
        <ClanLink href="/welcome" className="text-gold hover:text-gold-light">
          set your account up step by step
        </ClanLink>{' '}
        — character, clan and plugin, in order.
      </p>
    </div>
  );
}

/** One word for how you are attached. Staff is a separate axis and outranks the seat for display. */
function seatWord(c: ClanCard): string {
  if (c.staff) return c.seat === 'member' ? 'Staff' : 'Staff · guest';
  return c.seat === 'member' ? 'Member' : c.seat === 'guest' ? 'Guest' : 'No seat';
}

/** "closes in 3d" / "starts Sep 2" / "open" — whichever of the two dates actually bounds it. */
function closes(deadline: string | null, startDate: string | null): string {
  if (deadline) {
    const ms = Date.parse(deadline) - Date.now();
    if (Number.isFinite(ms) && ms > 0) {
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor(ms / 3_600_000);
      return d >= 1 ? `closes in ${d}d` : h >= 1 ? `closes in ${h}h` : 'closes within the hour';
    }
  }
  if (startDate) {
    const t = Date.parse(startDate);
    if (Number.isFinite(t)) {
      return `starts ${new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
  }
  return 'sign-ups open';
}

function summary(clans: number, running: number, signups: number): string {
  if (clans === 0) return 'Nothing here yet.';
  const c = `${clans} clan${clans === 1 ? '' : 's'}`;
  const bits: string[] = [];
  if (running > 0) bits.push(`${running} thing${running === 1 ? '' : 's'} running`);
  if (signups > 0) bits.push(`${signups} taking entries`);
  if (bits.length === 0) return `${c}, and nothing running in any of them.`;
  return `${c}. ${bits.join(', ')}.`;
}

// Server component — evaluated once per request, not on client renders.
function greeting(): string {
  const h = new Date().getUTCHours();
  if (h < 5 || h >= 22) return 'Evening';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

/**
 * Seats we believe are this person's, offered rather than granted.
 *
 * The match is a Discord name-match the roster sync happened to record, which is a guess — so this
 * asks, and the answer is proved the normal way. Linking the character is what attaches the seat;
 * this only saves somebody having to know which of their names to type.
 */
function FoundSeats({ seats }: { seats: FoundSeat[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {seats.map((s) => (
        <div
          key={`${s.clanSlug}/${s.rsn}`}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/25 bg-gold/[0.04] px-4 py-3.5 sm:px-5"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{s.rsn}</span>
            <span className="mt-0.5 block truncate text-[12.5px] text-text-muted">
              on {s.clanName}&rsquo;s roster{s.member ? '' : ' as a guest'} · not connected yet
            </span>
          </span>
          <ClanLink
            href={`/profile?connect=${encodeURIComponent(s.rsn)}`}
            className="shrink-0 rounded-lg bg-gold px-3.5 py-2 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            That&rsquo;s me
          </ClanLink>
        </div>
      ))}
      <p className="text-[12px] text-text-dim">
        Matched by Discord name, so it is a guess — connecting the character is what proves it.
      </p>
    </div>
  );
}
