import { settingsCharacters } from '@/lib/settingsData';
import { MEMBER_SETTINGS_CARDS, resolveMemberHref } from '@/lib/memberSettingsIndex';
import { settingsSession } from '@/app/settings/settingsSession';
import ClanLink from '@/components/ClanLink';
import { SettingsTitle } from './_ui';
import { MemberSettingsSearch, SettingsCard } from './SettingsHub';

/**
 * /settings: what there is to set, in plain words, before any one page of it.
 *
 * It used to redirect to Login & devices, which left people reading the rail's labels and guessing
 * ("Announcements" held screenshot privacy; "Privacy" was a different thing). Now it opens on a
 * search box and one card per area, each saying what it controls and linking to the exact section.
 * The plugin links here and to /settings/announcements, so both stay.
 */
export default async function SettingsHome() {
  const session = await settingsSession();
  const characters = session.playerId ? await settingsCharacters(session.playerId) : [];
  const main = characters[0]?.accountId ?? null;

  return (
    <>
      <SettingsTitle title="Settings">
        Everything you can change on Anvil. Search for a setting, or pick an area below. Your plugin settings live here too: they
        used to be in RuneLite, and now they follow you to every computer.
      </SettingsTitle>

      <MemberSettingsSearch mainAccountId={main} />

      <section aria-labelledby="settings-areas" className="mt-8">
        <h2 id="settings-areas" className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <span className="h-5 w-1 bg-gold" aria-hidden />
          What you can change
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MEMBER_SETTINGS_CARDS.map((c) => (
            <SettingsCard key={c.id} card={{ ...c, href: resolveMemberHref(c.href, main) }} />
          ))}
        </div>
      </section>

      <p className="mt-8 text-[13px] text-text-muted">
        Looking for something that changed lately?{' '}
        <ClanLink href="/whats-new" className="text-gold hover:text-gold-light">
          See what&rsquo;s new
        </ClanLink>
        .
      </p>
    </>
  );
}
