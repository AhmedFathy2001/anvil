import ClanLink from '@/components/ClanLink';
import AddCharacterClient from '@/app/profile/AddCharacterClient';
import ProfileTabs, { HostForFriendsButton, SettingsButton } from '@/app/profile/ProfileTabs';
import type { MyClan } from '@/lib/myClans';
import CreatorChip from '@/components/CreatorChip';
import { YOUR_CLANS_HEADING, groupClansAndSpaces } from '@/lib/creatorSpaces';
import SupporterName from '@/components/SupporterName';
import type { SupporterView } from '@/components/SupporterSection';
import { ProfileAvatar, ProfileBanner } from '@/components/ProfileMedia';
import type { ShownProfileMedia } from '@/lib/profileMediaRules';

export interface PersonCharacter {
  id: number;
  rsn: string;
  shared: boolean;
  /** Where it stands with the clans — lib/characterStanding. */
  standing?: string;
  isPrimary?: boolean;
}

/**
 * You, across the platform — the "Everywhere" tab of the profile (`/profile?everywhere=1`, and
 * plain `/profile` for someone with no clan).
 *
 * Every clan tab is that clan's locker; this one holds only what is true of the PERSON regardless of
 * clan: which clans they are in and which characters they play. It changes nothing — every setting
 * that used to sit here (sharing, announcements, webhooks, chat, Supporter) is on /settings, one
 * button away, so the profile is a page you look at and settings is the page you change things on.
 */
export default function PersonProfile({
  displayName,
  clans,
  characters,
  detectedCount = 0,
  suggestedRsn = '',
  unfinishedSetup = false,
  supporter = null,
  media = null,
  discordAvatar = null,
}: {
  /** Their Discord avatar, shown when they have not uploaded one of their own. */
  discordAvatar?: string | null;
  /** Their own avatar and banner as shown now (Supporter perk, set on /settings/look). */
  media?: ShownProfileMedia | null;
  displayName: string;
  clans: MyClan[];
  characters: PersonCharacter[];
  /** Characters the plugin saw them play that aren't linked yet — reviewed on /settings/add. */
  detectedCount?: number;
  /** Their first run is still outstanding — see lib/onboarding's `offer`. */
  unfinishedSetup?: boolean;
  /** A name arrived at from `?connect=` — see AddCharacterClient. */
  suggestedRsn?: string;
  /** Their Anvil Supporter subscription, for the name's flair. */
  supporter?: SupporterView | null;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      {unfinishedSetup && (
        <ClanLink
          href="/welcome"
          className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-gold/35 bg-gold/[0.06] px-4 py-3 text-sm transition-colors hover:border-gold/60"
        >
          <span className="font-medium text-gold">Finish setting up</span>
          <span className="text-text-muted">— a couple of minutes, and the plugin fills in the rest by itself.</span>
        </ClanLink>
      )}

      {media?.banner && <ProfileBanner banner={media.banner} className="mb-5" />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {media?.avatar ? (
          <ProfileAvatar avatar={media.avatar} size={56} eager className="border-2 border-gold/45" />
        ) : discordAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={discordAvatar}
            alt=""
            width={56}
            height={56}
            referrerPolicy="no-referrer"
            className="h-14 w-14 shrink-0 rounded-full border-2 border-gold/45 object-cover"
          />
        ) : (
          <span className="h-8 w-1 rounded-full bg-gold" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-gold">
            <SupporterName name={displayName} tier={supporter?.tier} style={supporter?.style} plain />
          </h1>
          <p className="text-sm text-text-muted">
            {characters.length} character{characters.length === 1 ? '' : 's'} · {clans.filter((c) => c.seat).length} clan
            {clans.filter((c) => c.seat).length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HostForFriendsButton />
          <SettingsButton />
        </div>
      </div>

      <ProfileTabs clans={clans} current={null} />

      {detectedCount > 0 && (
        <ClanLink
          href="/settings/add"
          className="mb-5 flex items-center gap-2 rounded-xl border border-gold/35 bg-gold/[0.06] px-4 py-3 text-sm transition-colors hover:border-gold/60"
        >
          <span className="font-medium text-gold">
            We noticed you playing {detectedCount} character{detectedCount === 1 ? '' : 's'} that aren&rsquo;t linked yet.
          </span>
          <span className="ml-auto text-text-muted">Review →</span>
        </ClanLink>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="rounded-xl border border-card-border bg-card-bg p-5">
          {clans.length === 0 ? (
            <>
              <div className="mb-4 flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-gold" />
                <h2 className="text-lg font-semibold">{YOUR_CLANS_HEADING}</h2>
              </div>
              <p className="text-sm text-text-muted">
                You&rsquo;re not in a clan yet.{' '}
                <ClanLink href="/clans" className="text-gold hover:text-gold-light">
                  Browse the clans on Anvil
                </ClanLink>
                .
              </p>
            </>
          ) : (
            // "Your clans", then "Your spaces" (creator spaces are not clans). Only non-empty groups.
            groupClansAndSpaces(clans, (c) => c.clanKind).map((g, i) => (
            <div key={g.key} className={i > 0 ? 'mt-6' : undefined}>
            <div className="mb-4 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-gold" />
              <h2 className="text-lg font-semibold">{g.label}</h2>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {g.items.map((c) => (
                <li key={c.id}>
                  <ClanLink
                    href={c.seat ? `/c/${c.slug}/profile` : `/c/${c.slug}`}
                    className="block rounded-lg border border-card-border bg-brown-dark/40 p-4 transition-colors hover:border-gold/40"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{c.name}</span>
                      {g.key === 'spaces' && <CreatorChip />}
                    </span>
                    <span className="mt-1 flex gap-2 text-xs text-text-muted">
                      {c.seat === 'member' && <span className="text-gold">Member</span>}
                      {c.seat === 'guest' && <span>{c.clanKind === 'creator' ? 'Player' : 'Guest'}</span>}
                      {!c.seat && <span>Not on the member list</span>}
                      {c.staff && <span className="capitalize text-gold/70">· {c.role || 'staff'}</span>}
                    </span>
                    {c.seat && <span className="mt-2 block text-[12.5px] text-text-muted">Your board, team and this week →</span>}
                  </ClanLink>
                </li>
              ))}
            </ul>
            </div>
            ))
          )}
        </section>

        <section className="rounded-xl border border-card-border bg-card-bg p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-gold" />
            <h2 className="text-lg font-semibold">Characters</h2>
          </div>
          {characters.length === 0 ? (
            <div id="plugin-token">
              <p className="mb-4 text-sm text-text-muted">No characters linked yet. Here&rsquo;s the quickest way to add your first.</p>
              <AddCharacterClient first suggestedRsn={suggestedRsn} linkedCount={0} detectedCount={detectedCount} />
            </div>
          ) : (
            <ul className="grid gap-2">
              {characters.map((a) => (
                <li key={a.id} className="rounded-lg border border-tile-border bg-tile-bg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <ClanLink href={`/p/${encodeURIComponent(a.rsn)}`} className="min-w-0 font-semibold hover:text-gold">
                      <SupporterName name={a.rsn} tier={supporter?.tier} style={supporter?.style} plain className="max-w-full" />
                    </ClanLink>
                    {a.isPrimary && <span className="rounded-full border border-gold-dark px-1.5 text-[10.5px] text-gold">main</span>}
                    {!a.shared && <span className="rounded-full border border-card-border px-1.5 text-[10.5px] text-text-muted">private</span>}
                    <ClanLink href={`/settings/characters/${a.id}`} className="ml-auto text-[12px] text-text-muted hover:text-gold" aria-label={`Settings for ${a.rsn}`}>
                      ⚙
                    </ClanLink>
                  </div>
                  {a.standing && <span className="mt-0.5 block text-xs text-text-muted">{a.standing}</span>}
                </li>
              ))}
            </ul>
          )}
          {!supporter && characters.length > 0 && (
            <ClanLink href="/settings/supporter" className="mt-4 block text-[12.5px] text-text-muted hover:text-gold">
              Wear your name in colour on every board — Anvil Supporter →
            </ClanLink>
          )}
        </section>
      </div>
    </div>
  );
}
