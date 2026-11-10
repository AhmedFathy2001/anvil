import MotionImg from '@/components/MotionImg';
import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';
import type { CreatorEventItem, CreatorHomeView } from '@/lib/creatorHome';
import type { ShownHighlight } from '@/lib/highlights/rules';
import HighlightsStrip from '@/components/HighlightsStrip';
import CreatorFeatured from '@/components/CreatorFeatured';
import CreatorPanels from '@/components/CreatorPanels';
import CreatorSchedule from '@/components/CreatorSchedule';
import ReportButton from '@/components/ReportButton';
import type { PublicSpacePage } from '@/lib/spacePage/store';
import { accentStyle } from '@/lib/accentStyle';
import { CREATOR_STAFF_ONLY_TAG } from '@/lib/creatorSpaces';

// A creator space's page (lib/creatorSpaces), in the space's own colour (lib/accentStyle: the root
// sets --sa and friends, everything inside reads them). Who runs it, whether they are live, the event
// to join right now, how to play, their clips, the rest of their events and a wall of past winners.
// No member count, no recruiting, no "apply" — a creator space has no roster; the way in is each
// event's own sign-up.

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="display text-2xl font-semibold">{children}</span>
      {aside && <span className="text-sm text-text-muted">{aside}</span>}
    </h2>
  );
}

const PLATFORM_BADGE: Record<string, { short: string; cls: string }> = {
  kick: { short: 'K', cls: 'bg-[#173d1f] text-[#53fc18]' },
  twitch: { short: 'T', cls: 'bg-[#2a1a45] text-[#c9a8ff]' },
  youtube: { short: 'YT', cls: 'bg-[#3d1616] text-[#ff7b7b]' },
};

/** A channel the space connected through that platform's sign-in, so it is shown as verified. */
function StreamLink({ link }: { link: CreatorHomeView['links'][number] }) {
  const badge = PLATFORM_BADGE[link.platform];
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Verified: this space signed in as ${link.handle} on ${link.label}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-card-border bg-card-bg px-3.5 text-sm font-medium transition-colors hover:border-[var(--sa)]"
    >
      {badge && (
        <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${badge.cls}`} aria-hidden>
          {badge.short}
        </span>
      )}
      <span>{link.label}</span>
      <span className="text-text-muted">{link.handle}</span>
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="shrink-0 text-accent-green-light">
        <path
          fill="currentColor"
          d="M8 0.5 9.9 2l2.4-.2.7 2.3 2 1.4-.8 2.3.8 2.3-2 1.4-.7 2.3-2.4-.2L8 15.5 6.1 14l-2.4.2-.7-2.3-2-1.4.8-2.3L1 5.9l2-1.4.7-2.3 2.4.2Zm-1 10.3 4.6-4.6-1-1L7 8.8 5.4 7.2l-1 1Z"
        />
      </svg>
      <span className="sr-only">(verified)</span>
    </a>
  );
}

/** "Nov 7" — day-level; the event pages carry the times. */
function shortDate(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
}

type Group = 'live' | 'open' | 'upcoming';

/** The one event to put in front of a viewer: running first, then open to join, then the next one. */
function spotlightOf(view: CreatorHomeView): { item: CreatorEventItem; group: Group } | null {
  for (const group of ['live', 'open', 'upcoming'] as const) {
    const item = view.events.groups[group][0];
    if (item) return { item, group };
  }
  return null;
}

const SPOT_TAG: Record<Group, string> = { live: 'Running now', open: 'Open to join', upcoming: 'Coming up' };

function Spotlight({ item, group }: { item: CreatorEventItem; group: Group }) {
  const joinable = group !== 'upcoming';
  return (
    <section className="mt-10 overflow-hidden rounded-3xl border border-card-border bg-card-bg" aria-label="Featured event">
      <div className="flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8" style={{ background: 'linear-gradient(var(--sa-soft), transparent 70%)' }}>
        <div className="min-w-0 flex-[1_1_22rem]">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sa-text)]">
            {group === 'live' && <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />}
            {SPOT_TAG[group]} · {item.kind}
            {item.staffOnly && <span className="rounded-full border border-card-border px-2 py-px text-[11px] normal-case tracking-normal text-text-muted">{CREATOR_STAFF_ONLY_TAG}</span>}
          </p>
          <h2 className="display mt-3 text-4xl font-semibold leading-[1.05] sm:text-5xl">{item.name}</h2>
          {item.line && <p className="mt-3 text-[15px] text-text-muted">{item.line}</p>}
          {item.top && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-background/60 px-3.5 py-2 text-sm">
              <span className="text-text-muted">{group === 'live' ? 'Leading' : 'Top'}</span>
              <span className="font-semibold">{item.top.name}</span>
              <span className="text-text-muted">{item.top.text}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          {joinable && (
            <ClanLink
              href={`/events/${item.id}/signup`}
              className="inline-flex min-h-[52px] items-center rounded-2xl bg-[var(--sa)] px-7 text-base font-bold text-[var(--sa-ink)] transition-opacity hover:opacity-90"
            >
              Join the event
            </ClanLink>
          )}
          <ClanLink
            href={item.href}
            className="inline-flex min-h-[52px] items-center rounded-2xl border border-card-border px-6 text-[15px] font-medium transition-colors hover:border-[var(--sa)]"
          >
            {group === 'live' ? 'See the board' : 'Details'}
          </ClanLink>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { title: 'Sign in with Discord', body: 'One tap. No new password.' },
  { title: 'Add your character', body: 'Type your RuneScape name and pick a team, or get placed on one.' },
  { title: 'Install the Anvil plugin', body: 'From the RuneLite Plugin Hub. Your drops count by themselves.' },
];

function HowToPlay() {
  return (
    <section className="mt-12">
      <SectionTitle>Play in three steps</SectionTitle>
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-card-border bg-card-bg p-5">
            <span className="display flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--sa-soft)] text-lg font-semibold text-[var(--sa-text)]">
              {i + 1}
            </span>
            <h3 className="mt-4 font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EventCard({ item, group }: { item: CreatorEventItem; group: Group | 'past' }) {
  return (
    <li>
      <ClanLink
        href={item.href}
        className="flex h-full flex-col gap-2 rounded-2xl border border-card-border bg-card-bg p-5 transition-colors hover:border-[var(--sa)]"
      >
        <span className="text-xs text-text-muted">
          {group === 'past' ? shortDate(item.when) || 'Finished' : group === 'live' ? 'Running now' : group === 'open' ? 'Open to join' : `Starts ${shortDate(item.when)}`}
          {' · '}
          {item.kind}
        </span>
        <span className="display text-xl font-semibold leading-tight">{item.name}</span>
        {item.staffOnly && <span className="text-[11px] text-text-muted">{CREATOR_STAFF_ONLY_TAG}</span>}
        {item.top ? (
          <span className="mt-auto flex items-center gap-2 pt-2 text-sm">
            {group === 'past' && (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--sa-text)]" aria-hidden>
                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" />
              </svg>
            )}
            <span>
              <b className="font-semibold">{item.top.name}</b> <span className="text-text-muted">{group === 'past' ? 'won' : 'leads'} · {item.top.text}</span>
            </span>
          </span>
        ) : (
          item.line && <span className="mt-auto pt-2 text-sm text-text-muted">{item.line}</span>
        )}
      </ClanLink>
    </li>
  );
}

export default function CreatorHome({
  view,
  highlights = [],
  page = null,
  canReport = false,
}: {
  view: CreatorHomeView;
  /** Stream highlights (lib/highlights), already cut to events this viewer may see. */
  highlights?: (ShownHighlight & { eventName: string })[];
  /** The space's own page content (lib/spacePage): featured, schedule, bio and panels. */
  page?: PublicSpacePage | null;
  /** The viewer is signed in, so may report the page, a panel or a clip. */
  canReport?: boolean;
}) {
  const spot = spotlightOf(view);
  const liveOn = view.links.filter((l) => (l.platform === 'twitch' && page?.live.twitch) || (l.platform === 'kick' && page?.live.kick));
  // Everything the spotlight did not take, still running or ahead; then the finished ones.
  const more = (['live', 'open', 'upcoming'] as const).flatMap((g) =>
    view.events.groups[g].filter((it) => it.key !== spot?.item.key).map((item) => ({ item, group: g })),
  );
  const past = view.events.groups.past;

  return (
    <div className="mx-auto max-w-5xl" style={accentStyle(view.accent)}>
      {/* The banner, or the space's colour as a board grid when there is none. */}
      <div className="relative aspect-[3/1] w-full overflow-hidden rounded-3xl border border-card-border bg-[var(--sa-deep)]">
        {view.bannerUrl ? (
          <MotionImg src={view.bannerUrl} className="h-full w-full object-cover" style={{ objectPosition: `50% ${view.bannerPosition ?? 50}%` }} />
        ) : (
          <div
            className="h-full w-full"
            aria-hidden
            style={{
              backgroundImage: 'linear-gradient(#ffffff0d 1px, transparent 1px), linear-gradient(90deg, #ffffff0d 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        )}
      </div>

      {/* Only the avatar rides up over the banner (the header starts 56px into it); the name and
          the numbers are padded down to start just below the banner's edge, on the page. */}
      <header className="relative -mt-14 flex flex-wrap items-start gap-x-6 gap-y-3 px-4 sm:px-6">
        <div className="rounded-[28px] border-[5px] border-background bg-background">
          <ClanCrest variant="letter" slug={view.slug} name={view.name} logoUrl={view.logoUrl} size={112} rounded="rounded-[22px]" className="text-4xl" />
        </div>
        <div className="min-w-0 flex-[1_1_18rem] sm:pt-[4.25rem]">
          {liveOn.length > 0 && (
            <a
              href={liveOn[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#ff4d3d]/15 px-3 py-1 text-[13px] font-semibold text-[#ff8a7d]"
            >
              <span className="h-2 w-2 rounded-full bg-[#ff4d3d] shadow-[0_0_0_4px_rgba(255,77,61,.25)]" aria-hidden />
              Live now on {liveOn.map((l) => l.label).join(' and ')}
            </a>
          )}
          <h1 className="display text-4xl font-semibold leading-none text-foreground sm:text-5xl">{view.name}</h1>
          {view.tagline && <p className="mt-2 max-w-[60ch] text-[15px] text-text-muted">{view.tagline}</p>}
        </div>
        <div className="flex gap-6 text-right sm:pt-[4.75rem]">
          <div>
            <div className="text-2xl font-bold tabular-nums">{view.eventsRun}</div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted">{view.eventsRun === 1 ? 'event' : 'events'}</div>
          </div>
          {view.playerCount != null && (
            <div>
              <div className="text-2xl font-bold tabular-nums">{view.playerCount}</div>
              <div className="text-[11px] uppercase tracking-wide text-text-muted">players</div>
            </div>
          )}
        </div>
      </header>

      {view.links.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 px-4 sm:px-6">
          {view.links.map((l) => (
            <StreamLink key={l.platform} link={l} />
          ))}
        </div>
      )}

      {spot ? (
        <Spotlight item={spot.item} group={spot.group} />
      ) : (
        <div className="mt-10 rounded-3xl border border-card-border bg-card-bg p-6 text-sm text-text-muted">No events yet. Check back soon.</div>
      )}

      <CreatorFeatured featured={page?.featured ?? null} />
      {/* The hero already says "live"; the schedule only appears when there is a schedule to show. */}
      {(page?.schedule?.length ?? 0) > 0 && <CreatorSchedule slots={page?.schedule ?? []} hostTz={page?.scheduleTz ?? null} live={liveOn} />}

      {spot && spot.group !== 'upcoming' && <HowToPlay />}

      {highlights.length > 0 && (
        <div className="mt-12">
          <HighlightsStrip highlights={highlights} blurb="clipped live from the stream during these events" showEvent canReport={canReport} />
        </div>
      )}

      {/* The same rows the header counts (lib/creatorHome creatorEventsView), as cards. */}
      <div id="events" className="scroll-mt-20">
        {more.length > 0 && (
          <section className="mt-12">
            <SectionTitle>More events</SectionTitle>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {more.map(({ item, group }) => (
                <EventCard key={item.key} item={item} group={group} />
              ))}
            </ul>
          </section>
        )}
        {past.length > 0 && (
          <section className="mt-12">
            <SectionTitle aside={<ClanLink href="/events" className="hover:text-foreground">All events →</ClanLink>}>Winners wall</SectionTitle>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {past.slice(0, 9).map((item) => (
                <EventCard key={item.key} item={item} group="past" />
              ))}
            </ul>
          </section>
        )}
      </div>

      <CreatorPanels clanId={view.id} bio={page?.bio ?? null} panels={page?.panels ?? []} canReport={canReport} />

      {view.players.length > 0 && (
        <section className="mt-12">
          <SectionTitle aside={view.playerCount != null && view.playerCount > view.players.length ? `latest ${view.players.length} of ${view.playerCount}` : undefined}>
            Players
          </SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {view.players.map((p) => (
              <li
                key={p.accountId}
                className="rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-[13px]"
                title={`${p.events} event${p.events === 1 ? '' : 's'}`}
              >
                {p.rsn}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-card-border bg-card-bg px-5 py-4 text-[13.5px]">
        <span className="min-w-0 flex-[1_1_22rem] text-text-muted">
          These events run on Anvil, a free indie project for OSRS. Host your own for your viewers or friends.
        </span>
        <ClanLink href="/host" className="text-[var(--sa-text)] hover:opacity-80">
          Host an event
        </ClanLink>
      </div>
      <p className="mt-4 text-center text-[11.5px] text-text-dim">
        Not affiliated with Jagex Ltd. Old School RuneScape is a trademark of Jagex Ltd. Promotions on Anvil must follow
        Jagex&rsquo;s rules.
      </p>
      {/* The whole page, to Anvil staff (lib/platformReports). Signed-in viewers only. */}
      {canReport && (
        <div className="mt-2 text-center">
          <ReportButton type="space" id={view.id} label="Report this page" />
        </div>
      )}
    </div>
  );
}
