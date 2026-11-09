import { headers } from 'next/headers';
import type { Metadata } from 'next';

import { verifyUser } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { SUPPORTER_TIERS } from '@/lib/supporterTiers';
import {
  SIGNED_OUT,
  WHATS_NEW,
  WHATS_NEW_TAB_PARAM,
  bucketEntries,
  forYouCards,
  pickTab,
  hasClanLinks,
  resolveLinks,
  signInHref,
  type Viewer,
  type WhatsNewEntry,
} from '@/lib/whatsNew';
import { viewerFor } from '@/lib/whatsNewViewer';
import ClanLink from '@/components/ClanLink';
import WhatsNewTabs from './WhatsNewTabs';
import WhatsNewList, { type ListItem } from './WhatsNewList';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'What’s new for you',
  description:
    'The latest changes to Anvil in plain words, for players, Supporters and clan staff, with links straight to where you can try them.',
  alternates: { canonical: '/whats-new' },
};

/**
 * What's new, for the person reading it (lib/whatsNew): tabs per scope (For you, Everyone, Players,
 * Clan staff, Supporters, Creators), each with its entries under date headers, and every link filled
 * in for THIS viewer's clans. `?tab=staff` opens a tab. The full release notes stay on /changelog.
 */
export default async function WhatsNewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const onApex = isApexHost((await headers()).get('host'));
  const viewer = await resolveViewer(onApex);
  const asked = (await searchParams)[WHATS_NEW_TAB_PARAM];

  const buckets = bucketEntries(WHATS_NEW, viewer);
  const initial = pickTab(buckets, typeof asked === 'string' ? asked : null);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-8">
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
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg p-5">
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

      <WhatsNewTabs
        initial={initial}
        newest={WHATS_NEW[0]?.date ?? ''}
        signedIn={viewer.signedIn}
        tabs={buckets.map((b) => ({
          id: b.id,
          label: b.label,
          count: b.entries.length,
          panel: (
            <section aria-label={b.label}>
              {b.id === 'you' && whoNote(viewer) && <p className="mb-4 text-[13px] text-text-dim">{whoNote(viewer)}</p>}
              <WhatsNewList
                items={(b.id === 'you' ? forYouCards(b.entries, viewer) : b.entries.map((entry) => ({ entry, chips: [] as string[] }))).map(
                  ({ entry, chips }) => toItem(entry, chips, viewer),
                )}
              />
            </section>
          ),
        }))}
      />
    </div>
  );
}

function toItem(entry: WhatsNewEntry, chips: string[], viewer: Viewer): ListItem {
  return {
    id: entry.id,
    date: entry.date,
    title: entry.title,
    body: entry.body,
    chips,
    links: resolveLinks(entry, viewer).map((l) => ({ href: l.href, label: l.label, signIn: !!l.signIn })),
    pluginNext: entry.pluginUpdate === 'next',
    clanHint: !viewer.signedIn && hasClanLinks(entry),
    signInHref: signInHref('/whats-new'),
  };
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

/** Who is reading (lib/whatsNewViewer); signed out reads the general page. */
async function resolveViewer(onApex: boolean): Promise<Viewer> {
  const session = await verifyUser();
  if (!session) return { ...SIGNED_OUT, onApex };
  return viewerFor(session.userId, session.playerId ?? null, onApex);
}
