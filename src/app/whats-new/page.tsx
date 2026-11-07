import { and, eq, isNotNull } from 'drizzle-orm';
import { headers } from 'next/headers';
import type { Metadata } from 'next';

import { db } from '@/db';
import { accountPluginSeen, accounts, users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { clanBoostLevels } from '@/lib/clanBoosts';
import { clansOfPerson } from '@/lib/myClans';
import { supporterForUser } from '@/lib/supporter';
import { SUPPORTER_TIERS } from '@/lib/supporterTiers';
import {
  SIGNED_OUT,
  WHATS_NEW,
  entryDate,
  hasClanLinks,
  isForViewer,
  resolveLinks,
  signInHref,
  type Viewer,
  type WhatsNewEntry,
} from '@/lib/whatsNew';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'What’s new for you',
  description:
    'The latest changes to Anvil in plain words, for players, Supporters and clan staff, with links straight to where you can try them.',
  alternates: { canonical: '/whats-new' },
};

/**
 * What's new, for the person reading it (lib/whatsNew): the entries meant for their Supporter tier,
 * their clans and their plugin use first, with links filled in for their own clan; then everything.
 * The full release notes stay on /changelog.
 */
export default async function WhatsNewPage() {
  const onApex = isApexHost((await headers()).get('host'));
  const viewer = await resolveViewer(onApex);

  const forYou = WHATS_NEW.filter((e) => isForViewer(e, viewer));
  const forYouIds = new Set(forYou.map((e) => e.id));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="display display-lg text-[clamp(1.8rem,4vw,2.4rem)] font-semibold">What&rsquo;s new</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] text-text-muted">
          The changes you&rsquo;re most likely to notice, in plain words.
          {onApex && (
            <>
              {' '}
              Every fix, release by release, is in the{' '}
              <ClanLink href="/changelog" className="text-gold hover:text-gold-light">
                full release notes
              </ClanLink>
              .
            </>
          )}
        </p>
      </header>

      {!viewer.signedIn && (
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg p-5">
          <p className="text-[14px] text-text-muted">
            Sign in to see what&rsquo;s new for your clan and your Supporter tier, with links to your own pages.
          </p>
          <ClanLink
            href={signInHref('/whats-new')}
            className="shrink-0 rounded-lg bg-gold px-4 py-2 text-[14px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            Sign in
          </ClanLink>
        </div>
      )}

      {viewer.signedIn && (
        <section className="mb-12" aria-labelledby="for-you">
          <SectionTitle id="for-you" title="For you" note={whoNote(viewer)} />
          {forYou.length > 0 ? (
            <ol className="grid gap-3">
              {forYou.map((e) => (
                <EntryCard key={e.id} entry={e} viewer={viewer} />
              ))}
            </ol>
          ) : (
            <p className="rounded-xl border border-card-border bg-card-bg p-5 text-[14px] text-text-muted">
              Nothing aimed at you in particular this time. Everything that changed is below.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="everything">
        <SectionTitle id="everything" title="Everything new" />
        <ol className="grid gap-3">
          {WHATS_NEW.map((e) => (
            <EntryCard key={e.id} entry={e} viewer={viewer} tagged={forYouIds.has(e.id)} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function SectionTitle({ id, title, note }: { id: string; title: string; note?: string | null }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="flex items-center gap-2.5 text-[17px] font-semibold">
        <span className="h-5 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
        {title}
      </h2>
      {note && <p className="mt-1 pl-[14px] text-[13px] text-text-dim">{note}</p>}
    </div>
  );
}

function EntryCard({ entry, viewer, tagged = false }: { entry: WhatsNewEntry; viewer: Viewer; tagged?: boolean }) {
  const links = resolveLinks(entry, viewer);
  const clanHint = !viewer.signedIn && hasClanLinks(entry);
  return (
    <li className="rounded-xl border border-card-border bg-card-bg p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[15.5px] font-semibold">
          {entry.title}
          {tagged && (
            <span className="ml-2 rounded-full border border-gold/40 px-2 py-0.5 align-middle text-[11px] font-medium text-gold">
              For you
            </span>
          )}
        </h3>
        <time dateTime={entry.date} className="text-[12.5px] tabular-nums text-text-dim">
          {entryDate(entry.date)}
        </time>
      </div>
      <p className="mt-1.5 text-[14px] leading-relaxed text-text-muted">{entry.body}</p>
      {entry.pluginUpdate === 'next' && (
        <p className="mt-2 text-[12.5px] text-text-dim">Coming in the next plugin update. RuneLite installs it for you.</p>
      )}
      {(links.length > 0 || clanHint) && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13.5px]">
          {links.map((l) => (
            <li key={`${l.href}|${l.label}`}>
              <ClanLink href={l.href} className="text-gold transition-colors hover:text-gold-light">
                {l.signIn ? `Sign in: ${l.label}` : l.label} &rarr;
              </ClanLink>
            </li>
          ))}
          {clanHint && (
            <li className="text-text-dim">
              <ClanLink href={signInHref('/whats-new')} className="underline-offset-2 hover:text-foreground hover:underline">
                Sign in
              </ClanLink>{' '}
              for a link to your clan&rsquo;s page
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

/** "Picked for your Champion membership and The AFK Spot." Says what the page went on, briefly. */
function whoNote(v: Viewer): string | null {
  const parts: string[] = [];
  if (v.tier) parts.push(`your ${SUPPORTER_TIERS[v.tier].name} membership`);
  const names = v.clans.map((c) => c.name);
  if (names.length === 1) parts.push(names[0]);
  else if (names.length > 1) parts.push(`your ${names.length} clans and spaces`);
  if (v.pluginUser) parts.push('the plugin');
  if (parts.length === 0) return null;
  const last = parts.pop()!;
  return `Picked for ${parts.length ? `${parts.join(', ')} and ${last}` : last}.`;
}

/**
 * Who is reading: Supporter tier, every clan they belong to (a seat or a staff grant, lib/myClans)
 * with their role and the clan's boost level, and whether any character of theirs has played with
 * the plugin. Each lookup fails soft: a missing piece only makes the page less personal.
 */
async function resolveViewer(onApex: boolean): Promise<Viewer> {
  const session = await verifyUser();
  if (!session) return { ...SIGNED_OUT, onApex };

  const [supporter, myClans, pluginUser] = await Promise.all([
    supporterForUser(session.userId).catch(() => null),
    clansOfPerson(session.playerId ?? null, session.userId).catch(() => []),
    usesPlugin(session.userId, session.playerId ?? null).catch(() => false),
  ]);
  const levels = myClans.length
    ? await clanBoostLevels(myClans.map((c) => c.id)).catch(() => new Map<number, { level: number }>())
    : new Map<number, { level: number }>();

  return {
    signedIn: true,
    tier: supporter?.tier.id ?? null,
    clans: myClans.map((c) => ({ slug: c.slug, name: c.name, kind: c.clanKind, role: c.role, boostLevel: levels.get(c.id)?.level ?? 0 })),
    pluginUser,
    onApex,
  };
}

/** Has this person used the plugin: a device token, or any character the plugin has reported from. */
async function usesPlugin(userId: number, playerId: number | null): Promise<boolean> {
  const [token] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNotNull(users.pluginTokenHash)))
    .limit(1);
  if (token) return true;
  if (playerId == null) return false;
  // clan-scope: global -- a person's own characters, across every clan.
  const [seen] = await db
    .select({ id: accountPluginSeen.accountId })
    .from(accountPluginSeen)
    .innerJoin(accounts, eq(accounts.id, accountPluginSeen.accountId))
    .where(eq(accounts.playerId, playerId))
    .limit(1);
  return !!seen;
}
