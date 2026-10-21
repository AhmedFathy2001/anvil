'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import WebhookField from '@/components/WebhookField';
import ClanLink from '@/components/ClanLink';
import type { BroadcastChannel } from '@/lib/discord-broadcast';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import { quickSetupLabel, QUICK_SETUP_GROUPS, type QuickSetupLayout } from '@/lib/discordQuickSetup';

// The setup wizard's Discord step, for someone who has never heard the word "webhook": add the bot
// (one Discord screen, then straight back here), then one button makes every channel. Pasting links
// by hand is still possible for a server that can't take a bot, folded away where nobody trips on it.

interface BotStatus {
  configured: boolean;
  tokenValid: boolean | null;
  guildVerified: boolean;
  inGuild: boolean | null;
  guildName: string | null;
  oauthConnect: boolean;
}

interface Row {
  settingKey: string;
  channelName: string | null;
  created: boolean;
  error?: string;
}

const CHOICES: { id: QuickSetupLayout; title: string; body: string }[] = [
  {
    id: 'few',
    title: 'A few channels',
    body: 'Events, drops & pets, deaths, and achievements each get their own. Recommended.',
  },
  {
    id: 'one',
    title: 'Just one channel',
    body: 'Events in one channel, everything players do in another. Good for small clans.',
  },
];

// What a failed connect came back with (api/auth/discord/callback → ?discord=…), in plain words.
const CONNECT_PROBLEM: Record<string, string> = {
  cancelled: 'You cancelled on Discord’s screen. Press the button again when you’re ready.',
  'not-admin':
    'The Discord account you used isn’t an admin of this clan here. Sign in with that account, or ask an admin to do this step.',
  'cant-manage':
    'That Discord account can’t add bots to the server you picked. Pick a server you own, or ask its owner.',
  claimed: 'That Discord server is already connected to another clan on Anvil.',
};

export default function ConnectDiscordStep({
  alreadyDone,
  channels,
  onDone,
}: {
  alreadyDone: boolean;
  channels: BroadcastChannel[];
  onDone: () => void;
}) {
  const params = useSearchParams();
  const outcome = params.get('discord');
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [choice, setChoice] = useState<QuickSetupLayout>('few');
  const [working, setWorking] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    clanFetch('/api/admin/discord/bot')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus(null))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, []);

  const ready =
    !!status && status.configured && status.tokenValid !== false && status.guildVerified && status.inGuild === true;

  async function setUp() {
    setWorking(true);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/discord/quick-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: choice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'That didn’t work. Try again in a moment.');
        return;
      }
      setRows(data.rows ?? []);
      if ((data.rows ?? []).some((r: Row) => !r.error)) onDone();
    } catch {
      setError('That didn’t work. Try again in a moment.');
    } finally {
      setWorking(false);
    }
  }

  if (!loaded) return <p className="text-sm text-text-muted">Checking your Discord…</p>;

  return (
    <div className="space-y-5">
      {outcome && outcome !== 'connected' && (
        <p className="text-sm rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2">
          {CONNECT_PROBLEM[outcome] ?? 'Discord didn’t finish adding the bot. Press the button again.'}
        </p>
      )}

      {!ready && (
        <div className="space-y-3">
          <p className="text-sm text-text-muted leading-relaxed">
            Anvil posts your events, drops and achievements in your Discord. First, let its bot in.
          </p>
          {status?.oauthConnect !== false ? (
            <a
              href={clanUrl('/api/admin/discord/bot/connect?then=setup')}
              className="inline-flex items-center justify-center min-h-11 px-5 rounded-lg bg-gold text-brown-dark font-bold hover:bg-gold-light transition-colors"
            >
              Add Anvil to your Discord
            </a>
          ) : (
            <ClanLink
              href="/admin/integrations"
              className="inline-flex items-center justify-center min-h-11 px-5 rounded-lg bg-gold text-brown-dark font-bold hover:bg-gold-light transition-colors"
            >
              Connect your bot
            </ClanLink>
          )}
          <p className="text-xs text-text-muted leading-relaxed">
            Discord asks which server to add it to. Pick yours and press{' '}
            <strong className="text-foreground">Authorise</strong> — you’ll come straight back here.
          </p>
        </div>
      )}

      {ready && (
        <div className="space-y-4">
          <p className="text-sm">
            <span className="text-green-400">✓</span> Anvil is in <strong>{status?.guildName ?? 'your server'}</strong>.
          </p>

          {alreadyDone && !rows ? (
            <p className="text-sm text-text-muted leading-relaxed">
              Your channels are already set up. Change them anytime under{' '}
              <ClanLink href="/admin/integrations" className="text-gold hover:underline">
                Discord
              </ClanLink>
              .
            </p>
          ) : rows ? (
            <ul className="space-y-1.5">
              {rows.map((r) => (
                <li key={r.settingKey} className="text-sm">
                  {r.error ? (
                    <span className="text-red-400">
                      ✕ {labelFor(choice, r.settingKey)}: {r.error}
                    </span>
                  ) : (
                    <>
                      <span className="text-green-400">✓</span> {labelFor(choice, r.settingKey)} →{' '}
                      <span className="text-gold">#{r.channelName}</span>
                      {r.created && <span className="text-text-muted"> (new)</span>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <fieldset className="grid gap-2.5 sm:grid-cols-2">
                <legend className="text-sm font-medium mb-2">Where should posts go?</legend>
                {CHOICES.map((c) => (
                  <label
                    key={c.id}
                    className={`rounded-xl border p-3.5 cursor-pointer transition-colors ${
                      choice === c.id ? 'border-gold bg-gold/5' : 'border-card-border hover:border-gold/40'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-sm">
                      <input
                        type="radio"
                        name="layout"
                        checked={choice === c.id}
                        onChange={() => setChoice(c.id)}
                        className="accent-gold"
                      />
                      {c.title}
                    </span>
                    <span className="block text-xs text-text-muted mt-1 leading-relaxed">{c.body}</span>
                  </label>
                ))}
              </fieldset>
              <button
                type="button"
                onClick={setUp}
                disabled={working}
                className="min-h-11 px-5 rounded-lg bg-gold text-brown-dark font-bold hover:bg-gold-light transition-colors disabled:opacity-60"
              >
                {working ? 'Setting up…' : 'Set it up for me'}
              </button>
              <p className="text-xs text-text-muted">
                The bot makes any channels you don’t have yet, in an “Anvil” category. Rename or move them freely.
              </p>
            </>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      <details className="group rounded-lg border border-card-border/60 px-3 py-2">
        <summary className="cursor-pointer text-xs text-text-muted hover:text-foreground">
          Can’t add a bot to your server?
        </summary>
        <div className="space-y-4 pt-3">
          <p className="text-xs text-text-muted leading-relaxed">
            You can give Anvil a channel’s link instead. In Discord, open the channel’s settings →{' '}
            <strong className="text-foreground">Integrations</strong> →{' '}
            <strong className="text-foreground">Webhooks</strong> →{' '}
            <strong className="text-foreground">New Webhook</strong> →{' '}
            <strong className="text-foreground">Copy Webhook URL</strong>, and paste it below.
          </p>
          <WebhookField label="Event news" channels={channels} botEnabled={false} helpText="" />
          <WebhookField
            settingKey="webhook_plugin_default"
            label="Drops, deaths and achievements"
            channels={channels}
            botEnabled={false}
            helpText=""
          />
        </div>
      </details>
    </div>
  );
}

function labelFor(layout: QuickSetupLayout, settingKey: string): string {
  return QUICK_SETUP_GROUPS[layout].find((t) => t.settingKey === settingKey)?.label ?? quickSetupLabel(settingKey);
}
