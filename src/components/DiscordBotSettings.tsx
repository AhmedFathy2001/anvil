'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/Input';
import { invalidateSettings } from '@/lib/settingsClient';

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
  sharedAvailable: boolean;
}

const SOURCE_LABEL: Record<BotSource, string> = {
  shared: 'Using the shared Anvil bot',
  byo: 'Using your own bot',
  'own-env': 'Using your bot token (from the environment)',
  none: 'No bot connected',
};

export default function DiscordBotSettings() {
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
        const res = await fetch('/api/admin/discord/bot');
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
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, string> = { guildId: guildId.trim() };
      if (tokenInput.trim()) payload.botToken = tokenInput.trim();
      const res = await fetch('/api/admin/discord/bot', {
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
      const res = await fetch('/api/admin/discord/bot', {
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

  const hasChanges = guildId.trim() !== status.guildId || tokenInput.trim() !== '';
  const badTokenSet = status.configured && status.tokenValid === false;

  return (
    <div className="space-y-4">
      {/* Effective source */}
      <div className="rounded-lg border border-card-border bg-bg/40 p-3">
        <p className="text-sm">
          <span className={status.source === 'none' || badTokenSet ? 'text-yellow-400' : 'text-green-400'}>
            {status.source === 'none' || badTokenSet ? '•' : '✓'} {SOURCE_LABEL[status.source]}
          </span>
          {status.configured && status.botUser && (
            <span className="text-text-muted"> — connected as <span className="text-foreground/80">{status.botUser}</span></span>
          )}
        </p>
        {badTokenSet && (
          <p className="text-xs text-yellow-400 mt-1">
            The current bot token was rejected by Discord — replace it below or clear it.
          </p>
        )}
        {status.source === 'shared' && (
          <p className="text-xs text-text-muted mt-1">
            Managed for you — nothing to set up. Invite scope aside, you only need to keep the Anvil bot in your
            server. Paste your own token below to use a different bot instead.
          </p>
        )}
        {status.source === 'none' && (
          <p className="text-xs text-text-muted mt-1">
            Webhook creation, role sync and team channels stay off until a bot is connected. Paste a bot token
            below{status.sharedAvailable ? ', or nothing — the shared Anvil bot will be used' : ''}.
          </p>
        )}
      </div>

      {/* BYO token (write-only) */}
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
          saved; stored server-side and never shown again.
          {status.source === 'byo' && status.sharedAvailable && ' Clear it to go back to the shared Anvil bot.'}
        </p>
      </div>

      {/* Guild / server ID */}
      <div>
        <label className="block text-sm font-medium mb-1">Discord server (guild) ID</label>
        <Input
          value={guildId}
          onChange={(e) => setGuildId(e.target.value)}
          placeholder="e.g. 123456789012345678"
          className="w-full px-3 py-2 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
        />
        <p className="text-xs text-text-muted mt-1">
          Right-click your server icon in Discord → Copy Server ID (needs Developer Mode on). The bot must be a
          member of this server.
        </p>
      </div>

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
    </div>
  );
}
