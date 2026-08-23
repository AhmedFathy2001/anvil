import AnvilMark from '@/components/AnvilMark';
import ClanCrest from '@/components/ClanCrest';
import ClanLink from '@/components/ClanLink';
import type { ApexHomeView, ClanCard } from '@/lib/apexHome';

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
  displayName,
}: {
  view: ApexHomeView;
  displayName: string;
}) {
  const live = view.clans.filter((c) => c.live.length > 0);
  const needsYou = view.clans.filter((c) => c.staff && c.live.length === 0);
  const running = view.clans.reduce((n, c) => n + c.live.length, 0);
  const quiet =
    running === 0 && needsYou.length === 0 && view.openSignups.length === 0 && view.clans.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="relative mb-9 overflow-hidden">
        <AnvilMark
          size={190}
          className="pointer-events-none absolute -top-10 right-0 hidden text-gold/[0.04] sm:block"
        />
        <h1 className="display display-lg relative text-[clamp(1.7rem,4vw,2.1rem)] font-semibold">
          {greeting()}, {displayName}
        </h1>
        <p className="relative mt-2 text-[15px] text-text-muted">
          {summary(view.clans.length, running, view.openSignups.length)}
        </p>
      </header>

      {view.clans.length === 0 ? (
        <Empty />
      ) : (
        <div className="flex flex-col gap-10">
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
              together, which is what makes it worth the space the clan list used to take. */}
          {view.characters.length > 0 && (
            <Section
              title="Your characters"
              note={`${view.characters.length}`}
              more={{ href: '/profile', label: 'Manage' }}
            >
              <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
                {view.characters.map((ch) => (
                  <li key={ch.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md bg-brown-light font-mono text-[11px] text-text-muted">
                      {ch.rsn.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <ClanLink
                        href={`/p/${encodeURIComponent(ch.rsn)}`}
                        className="block truncate text-[14.5px] hover:text-gold"
                      >
                        {ch.rsn}
                      </ClanLink>
                      <span className="mt-0.5 block truncate text-[12px] text-text-dim">
                        {ch.clanName ?? 'No clan'}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[13px] tabular-nums">
                        {ch.xpThisWeek > 0 ? compact(ch.xpThisWeek) : '—'}
                      </span>
                      <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">
                        xp / wk
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
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

function Empty() {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-7 sm:p-8">
      <h2 className="display text-xl font-semibold">You&rsquo;re not in a clan yet</h2>
      <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-text-muted">
        Join one that&rsquo;s recruiting, or start your own — a clan takes an evening to set up, and
        the plugin does the rest.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <ClanLink
          href="/clans"
          className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Find a clan
        </ClanLink>
        <ClanLink
          href="/clans/new"
          className="rounded-lg border border-card-border px-4 py-2.5 text-sm transition-colors hover:border-gold-dark"
        >
          Start one
        </ClanLink>
      </div>
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

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
