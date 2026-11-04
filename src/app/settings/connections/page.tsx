import type { ReactNode } from 'react';

import { verifyUser } from '@/lib/auth';
import { connectedAccountsForUser } from '@/lib/connectedAccounts';
import { PLATFORM_LABEL, type ConnectedLink, type Platform } from '@/lib/connectedAccountsRules';
import { twitchConfigured } from '@/lib/twitch';
import { youtubeConfigured } from '@/lib/gates/youtube';
import { kickConfigured } from '@/lib/kick';
import { ActionButton, BTN, SettingSwitch } from '../_client';
import { Pill, SettingsBlock, SettingsGroup, SettingsRow, SettingsTitle } from '../_ui';
import { KickLinker, MedalProfileForm } from './_client';
import { ConnectedAccountExtras } from './extras';


/** `?twitch=` / `?youtube=` from the OAuth callbacks — fixed words only, mapped to fixed text. */
const OUTCOMES: Record<string, { ok: boolean; text: string }> = {
  linked: { ok: true, text: 'linked.' },
  taken: { ok: false, text: 'account is already linked to another Anvil login. Unlink it there first.' },
  denied: { ok: false, text: 'sign-in was cancelled.' },
  nochannel: { ok: false, text: 'sign-in worked, but that Google account has no YouTube channel. Pick the account that owns your channel.' },
  scopes: { ok: false, text: 'sign-in didn’t grant what Anvil asked for. Try again and press Allow.' },
  error: { ok: false, text: 'link didn’t go through. Try again in a minute.' },
};

function outcome(platform: 'twitch' | 'youtube', v: string | string[] | undefined): { ok: boolean; text: string } | null {
  const o = typeof v === 'string' ? OUTCOMES[v] : undefined;
  return o ? { ok: o.ok, text: `${PLATFORM_LABEL[platform]} ${o.text}` } : null;
}

export default async function ConnectedAccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = (await verifyUser())!;
  const sp = await searchParams;
  const { links, medal } = await connectedAccountsForUser(session.userId);
  const by = new Map(links.map((l) => [l.platform, l]));
  const notes = [outcome('twitch', sp.twitch), outcome('youtube', sp.youtube)].filter((n): n is { ok: boolean; text: string } => !!n);

  const linkedRow = (l: ConnectedLink, description: ReactNode) => (
    <SettingsRow
      label={
        <>
          {PLATFORM_LABEL[l.platform]}
          {l.verified ? <Pill tone="green">✓ verified</Pill> : l.selfReported ? null : <Pill tone="yellow">not verified</Pill>}
        </>
      }
      description={description}
    >
      <ActionButton
        url={`/api/profile/connected-accounts/${l.platform}`}
        method="DELETE"
        tone="danger"
        confirm={{
          title: `Unlink ${PLATFORM_LABEL[l.platform]}?`,
          body: 'It comes off your profile. Events you already joined keep you; a gated event you join later asks you to link again.',
          confirmLabel: 'Unlink',
        }}
      >
        Unlink
      </ActionButton>
    </SettingsRow>
  );

  const showRow = (l: ConnectedLink) => (
    <SettingsRow
      label="Show on my profile"
      description={
        l.verified || l.selfReported
          ? 'On your public profile, when your characters are shown as one person.'
          : 'Shown with a “not verified” label until you verify it.'
      }
    >
      <SettingSwitch
        url={`/api/profile/connected-accounts/${l.platform}`}
        field="show"
        checked={l.showOnProfile}
        label={`Show ${PLATFORM_LABEL[l.platform]} on my profile`}
      />
    </SettingsRow>
  );

  const unlinked = (platform: Platform, description: ReactNode, control: ReactNode) => (
    <SettingsRow label={PLATFORM_LABEL[platform]} description={description}>
      {control}
    </SettingsRow>
  );

  const off = <span className="text-[12.5px] text-text-dim">Not available on this server</span>;
  const extras = (l: ConnectedLink) => <ConnectedAccountExtras platform={l.platform} userId={session.userId} link={l} />;

  const tw = by.get('twitch');
  const yt = by.get('youtube');
  const kick = by.get('kick');
  const md = by.get('medal');

  return (
    <>
      <SettingsTitle title="Connected accounts">
        Link where you stream and clip. Anvil only learns who you are on each one — it never posts as you or keeps a key to your
        account. Linked accounts also get you into streamers’ follower and subscriber events without linking again.
      </SettingsTitle>

      {notes.map((n) => (
        <p
          key={n.text}
          role="status"
          className={`mb-4 rounded-lg border px-3 py-2 text-[13px] ${
            n.ok ? 'border-accent-green/40 bg-accent-green/10 text-accent-green-light' : 'border-accent-red/40 bg-accent-red/10 text-accent-red'
          }`}
        >
          {n.text}
        </p>
      ))}

      <SettingsGroup title="Twitch">
        {tw ? (
          <>
            {linkedRow(tw, <>Linked as <b className="text-foreground">{tw.handle}</b></>)}
            {showRow(tw)}
            {/* EXTENSION POINT: per-platform settings (./extras) — e.g. stream highlights. */}
            {extras(tw)}
          </>
        ) : (
          unlinked(
            'twitch',
            'Sign in with Twitch. Anvil asks for no permissions.',
            twitchConfigured() ? (
              <a href="/api/auth/twitch/start?as=viewer&return=%2Fsettings%2Fconnections" className={BTN}>
                Link Twitch
              </a>
            ) : (
              off
            ),
          )
        )}
      </SettingsGroup>

      <SettingsGroup title="YouTube">
        {yt ? (
          <>
            {linkedRow(yt, <>Linked as <b className="text-foreground">{yt.handle}</b></>)}
            {showRow(yt)}
            {extras(yt)}
          </>
        ) : (
          unlinked(
            'youtube',
            'Sign in with Google and pick the account that owns your channel. Anvil reads which channel it is, once.',
            youtubeConfigured() ? (
              <a href="/api/auth/youtube/start?as=link&return=%2Fsettings%2Fconnections" className={BTN}>
                Link YouTube
              </a>
            ) : (
              off
            ),
          )
        )}
      </SettingsGroup>

      <SettingsGroup title="Kick">
        {kick ? (
          <>
            {linkedRow(kick, <>Linked as <b className="text-foreground">{kick.handle}</b></>)}
            {showRow(kick)}
            {extras(kick)}
          </>
        ) : kickConfigured() ? (
          <>
            {unlinked('kick', 'Kick has no “sign in with Kick” for this, so you type a one-time code in Anvil’s Kick chat instead.', null)}
            <SettingsBlock>
              <KickLinker />
            </SettingsBlock>
          </>
        ) : (
          unlinked('kick', 'Type a one-time code in a Kick chat.', off)
        )}
      </SettingsGroup>

      <SettingsGroup
        title="Medal"
        note="A link to your Medal profile, shown on your profile like any link you add. Medal has no sign-in, so it isn’t verified."
      >
        {md ? (
          <>
            {linkedRow(
              md,
              <>
                <b className="text-foreground">{md.handle}</b>
              </>,
            )}
            {showRow(md)}
            <SettingsBlock>
              <MedalProfileForm current={medal?.medalUsername ? `medal.tv/u/${medal.medalUsername}` : medal?.medalUserId ? `medal.tv/users/${medal.medalUserId}` : null} />
            </SettingsBlock>
            {extras(md)}
          </>
        ) : (
          <>
            {unlinked('medal', 'Paste the link to your Medal profile.', null)}
            <SettingsBlock>
              <MedalProfileForm current={null} />
            </SettingsBlock>
          </>
        )}
      </SettingsGroup>
    </>
  );
}
