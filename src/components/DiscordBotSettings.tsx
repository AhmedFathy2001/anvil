'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/Input';
import { invalidateSettings } from '@/lib/settingsClient';
import { clanFetch } from '@/lib/clanFetch';
import { useClanHref } from '@/lib/useClanPath';

// The bot-connection surface: which bot this instance uses (shared Anvil bot vs. your own), the
// write-only BYO token override, and the Discord server (guild) ID. Backed by /api/admin/discord/bot
// (the token is never sent back — only its source + a validated "connected as" name).

type BotSource = 'byo' | 'own-env' | 'shared' | 'none';

interface BotStatus {
  source: BotSource;
  configured: boolean;
  tokenValid: boolean | null;
  botUser: string | null;
  guildId: string;
  guildVerified: boolean;
  // Whether the bot is actually a member of THIS clan's server. null = unknown (no token, no server
  // ID, or Discord unreachable). A valid token alone proves nothing — with the shared bot it's valid
  // for every clan, including ones that never invited it.
  inGuild: boolean | null;
  guildName: string | null;
  missingPermissions: string[];
  // Ready-made Discord "add to server" link (pre-selects the configured server when set).
  inviteUrl: string | null;
  sharedAvailable: boolean;
  /** Adding the bot can report the server back (api/admin/discord/bot/connect). */
  oauthConnect: boolean;
}

// A clan admin is told which bot is posting for them, not where the operator keeps its token.
// 'own-env' and 'shared' are the same fact from this side of the screen — the managed Anvil bot —
// and the old 'own-env' wording ("from the environment") described the host's deployment to its
// customers.
const SOURCE_LABEL: Record<BotSource, string> = {
  shared: 'Using the shared Anvil bot',
  byo: 'Using your own bot',
  'own-env': 'Using the shared Anvil bot',
  none: 'No bot connected',
};

// What came back from "Connect your Discord server" (api/auth/discord/callback → ?discord=…).
const CONNECT_OUTCOME: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Connected — Anvil can now post and set things up in your server.' },
  cancelled: { ok: false, text: 'Cancelled on Discord’s screen. Nothing was changed.' },
  'not-admin': {
    ok: false,
    text: 'The Discord account you approved with isn’t an admin of this clan on Anvil. Sign in to Anvil with that account, or have a clan admin connect.',
  },
  'cant-manage': { ok: false, text: 'Discord says that account can’t manage the server you picked. Pick a server you own or have Manage Server on.' },
  claimed: { ok: false, text: 'That Discord server is already connected to another Anvil clan.' },
  'no-server': { ok: false, text: 'Discord didn’t say which server the bot was added to. Try again.' },
  'no-shared-bot': { ok: false, text: 'One-click connect only works with the shared Anvil bot. Enter your server ID below instead.' },
  'connect-expired': { ok: false, text: 'That took too long or was opened twice. Press Connect again.' },
  'discord-error': { ok: false, text: 'Discord didn’t answer properly. Try again in a moment.' },
};

export default function DiscordBotSettings() {
  const clanHref = useClanHref();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [guildId, setGuildId] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function apply(next: BotStatus) {
    setStatus(next);
    setGuildId(next.guildId);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await clanFetch('/api/admin/discord/bot');
        if (res.ok) {
          const next = (await res.json()) as BotStatus;
          setStatus(next);
          setGuildId(next.guildId);
        }
      } catch (error) {
        console.error('Failed to load bot status:', error);
      } finally {
        setLoading(false);
      }
      // The connect round trip lands back here with ?discord=<outcome>. Shown once, then dropped
      // from the address so a reload doesn't repeat it.
      const url = new URL(window.location.href);
      const outcome = url.searchParams.get('discord');
      if (outcome) {
        const known = CONNECT_OUTCOME[outcome] ?? CONNECT_OUTCOME['discord-error'];
        setMessage({ type: known.ok ? 'success' : 'error', text: known.text });
        url.searchParams.delete('discord');
        window.history.replaceState(null, '', url.toString());
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, string> = { guildId: guildId.trim() };
      if (tokenInput.trim()) payload.botToken = tokenInput.trim();
      const res = await clanFetch('/api/admin/discord/bot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        apply(data as BotStatus);
        setTokenInput('');
        invalidateSettings(); // guild id feeds other settings widgets
        setMessage({ type: 'success', text: 'Saved.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  }

  async function clearToken() {
    setClearing(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/discord/bot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        apply(data as BotStatus);
        setTokenInput('');
        setMessage({ type: 'success', text: 'Reverted to the default bot.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to clear token.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to clear token.' });
    } finally {
      setClearing(false);
    }
  }

  if (loading || !status) {
    return <div className="text-text-muted text-sm">Loading bot status…</div>;
  }

  // Existing installations predate ownership proof. Let their manager press Save without changing
  // the ID to verify it; until then every bot-driven feature treats the stored value as inert.
  const hasChanges = guildId.trim() !== status.guildId || tokenInput.trim() !== '' || (!!guildId.trim() && !status.guildVerified);
  const badTokenSet = status.configured && status.tokenValid === false;
  // "Ready" means the bot can actually do something HERE: a valid token AND membership of this
  // clan's server. Anything less is reported as work still to do, never as a green tick.
  const needsInvite = status.configured && !badTokenSet && status.inGuild === false;
  const needsGuildId = status.configured && !badTokenSet && !status.guildId;
  const ready = status.configured && !badTokenSet && status.guildVerified && status.inGuild === true;
  // The managed Anvil bot ('own-env' is the same bot from the clan's side — see SOURCE_LABEL).
  const managed = status.source === 'shared' || status.source === 'own-env';
  // With one-click connect there is a button for the whole job, so the by-hand server ID is a
  // fallback behind a fold rather than a second set of instructions under the first.
  const oneClick = managed && status.oauthConnect;
  const inviteButton = status.inviteUrl && (
    <a
      href={status.inviteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg font-semibold rounded-lg text-xs hover:bg-gold/90 transition-colors"
    >
      Add the bot to your server ↗
    </a>
  );
  // Re-running the invite repairs permissions or adds the bot to a second server. For the shared bot
  // it sits in the status box; for your own bot it lives with the token, in the advanced fold.
  const reinvite = status.inviteUrl && !needsInvite && (
    <p className="text-xs text-text-muted mt-2">
      <a href={status.inviteUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
        Invite / re-invite the bot ↗
      </a>{' '}
      — re-running this also repairs missing permissions.
      {!managed && ' Your own bot needs “Public Bot” enabled in its Discord app for this link to work.'}
    </p>
  );
  // ONE state line. It used to read "Using the shared Anvil bot — connected as Anvil" under a "Not
  // connected yet" heading: both true (the bot account is signed in, the clan's server is not linked),
  // and together they read as a contradiction. The managed bot is never the thing that is missing.
  const stateLine = ready ? (
    <>
      <span className="text-green-400">✓ {managed ? 'Connected' : SOURCE_LABEL[status.source]}</span>
      {status.guildName && (
        <span className="text-text-muted"> to <span className="text-foreground/80">{status.guildName}</span></span>
      )}
      {!managed && status.botUser && (
        <span className="text-text-muted"> as <span className="text-foreground/80">{status.botUser}</span></span>
      )}
    </>
  ) : managed && !badTokenSet ? (
    <span className="text-yellow-400">• Anvil’s bot is ready — connect your Discord server</span>
  ) : (
    <>
      <span className="text-yellow-400">• {SOURCE_LABEL[status.source]}</span>
      {status.configured && status.botUser && (
        <span className="text-text-muted"> — signed in as <span className="text-foreground/80">{status.botUser}</span></span>
      )}
    </>
  );

  const serverIdField = (
    <div>
      <label className="block text-sm font-medium mb-1">Your Discord server&apos;s ID</label>
      <Input
        value={guildId}
        onChange={(e) => setGuildId(e.target.value)}
        placeholder="e.g. 123456789012345678"
        className="w-full px-3 py-2 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
      />
      <p className="text-xs text-text-muted mt-1">
        A long number. In Discord: User Settings → Advanced → Developer Mode on, then right-click your server&apos;s
        icon → Copy Server ID. The bot must already be in the server, and the Discord account you signed in to
        Anvil with must own it or have Manage Server.
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Where this clan stands, in one line, plus whatever is still to do */}
      <div className="rounded-lg border border-card-border bg-bg/40 p-3">
        <p className="text-sm">{stateLine}</p>
        {badTokenSet && (
          <p className="text-xs text-yellow-400 mt-1">
            The current bot token was rejected by Discord — replace it below or clear it.
          </p>
        )}
        {needsInvite && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-yellow-400">
              The bot isn&apos;t in your Discord server yet{status.guildId ? ` (${status.guildId})` : ''}. Webhook
              creation, role sync, nickname sync and team channels will all fail until you add it — or the server
              ID below is wrong.
            </p>
            {inviteButton}
          </div>
        )}
        {needsGuildId && !managed && (
          <p className="text-xs text-yellow-400 mt-1">
            Add your Discord server ID below so Anvil knows which server to work in.
          </p>
        )}
        {!!status.guildId && !status.guildVerified && !badTokenSet && (
          <p className="text-xs text-yellow-400 mt-1">
            This server ID has not been ownership-verified yet. Sign in with a Discord account that owns the
            server or has Manage Server, make sure the bot is already in it, then press Save. Discord actions
            stay disabled until that succeeds.
          </p>
        )}
        {ready && status.missingPermissions.length > 0 && (
          <p className="text-xs text-yellow-400 mt-1">
            The bot is in your server but is missing {status.missingPermissions.join(', ')}. Grant those under
            Server Settings → Roles (and drag its role above the ones it manages), or re-run the invite link below.
          </p>
        )}
        {status.inGuild === null && status.configured && status.guildVerified && status.guildId && !badTokenSet && (
          <p className="text-xs text-text-muted mt-1">
            Couldn&apos;t reach Discord to check whether the bot is in your server — retry in a moment.
          </p>
        )}
        {managed && ready && (
          <p className="text-xs text-text-muted mt-1">
            Managed for you — you only need to keep the Anvil bot in your server.
          </p>
        )}
        {status.source === 'none' && (
          <p className="text-xs text-text-muted mt-1">
            Webhook creation, role sync and team channels stay off until a bot is connected. Paste a bot token
            below{status.sharedAvailable ? ', or nothing — the shared Anvil bot will be used' : ''}.
          </p>
        )}
        {managed && ready && reinvite}
      </div>

      {/* With the shared bot available, getting set up is one button — or, without one-click connect,
          two steps. The bring-your-own-bot token is an advanced option: it used to sit first on the
          page, so a new admin's first question was "where do I get a bot token?", which they never needed. */}
      {oneClick && !ready && (
        <div className="rounded-lg border border-gold/30 bg-gold/[0.05] p-3 space-y-2">
          <p className="text-xs text-text-muted leading-relaxed">
            Discord asks which server to add Anvil to, then sends you back here, connected. You need to own the
            server or have Manage Server, and to approve with the Discord account you use for Anvil.
          </p>
          {/* A navigation, not a fetch: it ends on Discord's own screen. */}
          <a
            href={clanHref('/api/admin/discord/bot/connect')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors"
          >
            Connect your Discord server
          </a>
        </div>
      )}
      {managed && !ready && !status.oauthConnect && (
        <div className="rounded-lg border border-gold/30 bg-gold/[0.05] p-3 space-y-2">
          <p className="text-sm font-medium">Two steps to connect your Discord</p>
          <ol className="list-decimal ml-5 space-y-1.5 text-xs text-text-muted leading-relaxed">
            <li>
              <span className="text-foreground/85">Add the Anvil bot to your server.</span>{' '}
              {status.inviteUrl ? (
                <a href={status.inviteUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
                  Add Anvil to Discord ↗
                </a>
              ) : (
                'The link appears here once the bot is reachable.'
              )}{' '}
              Pick your server on Discord&apos;s screen and press Authorize. You need to own the server or have
              Manage Server.
            </li>
            <li>
              <span className="text-foreground/85">Tell Anvil which server it is</span>: paste its ID in the box
              below and press Save.
            </li>
          </ol>
        </div>
      )}

      {/* BYO token (write-only) — folded behind "use your own bot" when the shared one is there. */}
      <ByoWrap folded={managed} open={status.source === 'byo'}>
      <div>
        <label className="block text-sm font-medium mb-1">
          Your bot token <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <Input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder={
            status.source === 'byo'
              ? 'A custom token is set — paste a new one to replace it'
              : 'Paste a bot token to use your own bot'
          }
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
        />
        <p className="text-xs text-text-muted mt-1">
          Discord Developer Portal → your application → Bot → Reset Token. Validated with Discord before it&apos;s
          saved; stored server-side and never shown again. Your own bot needs “Public Bot” enabled in its Discord
          app so it can be invited.
          {status.source === 'byo' && status.sharedAvailable && ' Clear it to go back to the shared Anvil bot.'}
        </p>
        {!managed && reinvite}
      </div>
      </ByoWrap>

      {/* Guild / server ID — the by-hand fallback when one-click connect does the job. */}
      {oneClick ? (
        <Fold label={ready ? 'Server ID' : 'Can’t use the button? Enter the server ID'} open={!!status.guildId && !status.guildVerified}>
          {serverIdField}
        </Fold>
      ) : (
        serverIdField
      )}

      {message && (
        <div
          className={`text-sm px-3 py-2 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Both fields can be folded away; a lone greyed-out Save under two closed folds is only noise. */}
      {(hasChanges || !oneClick) && (
      <div className="flex gap-2 items-center">
        <button
          onClick={save}
          disabled={saving || !hasChanges}
          className="px-4 py-2 bg-gold text-bg font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {status.source === 'byo' && (
          <button
            onClick={clearToken}
            disabled={clearing}
            className="px-4 py-2 bg-card-bg-hover border border-card-border text-text font-semibold rounded-lg text-sm hover:border-gold/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing ? 'Clearing…' : status.sharedAvailable ? 'Use shared bot' : 'Clear token'}
          </button>
        )}
        {!hasChanges && <span className="text-xs text-green-400">Saved</span>}
        {hasChanges && <span className="text-xs text-yellow-400">Unsaved changes</span>}
      </div>
      )}
    </div>
  );
}

/** The bring-your-own-bot token field, behind a fold when the shared Anvil bot already covers it. */
function ByoWrap({ folded, open, children }: { folded: boolean; open: boolean; children: React.ReactNode }) {
  if (!folded) return <>{children}</>;
  return (
    <Fold label="Use your own bot instead (advanced)" open={open}>
      {children}
    </Fold>
  );
}

function Fold({ label, open, children }: { label: string; open: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-lg border border-card-border">
      <summary className="cursor-pointer select-none list-none px-3 py-2 text-xs text-text-muted flex items-center gap-1.5">
        <span className="transition-transform group-open:rotate-90">▸</span>
        {label}
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}
