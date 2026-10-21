'use client';

import { useEffect, useMemo, useState } from 'react';
import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import Select, { type SelectOption } from '@/components/Select';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import type { BroadcastChannel } from '@/lib/discord-broadcast';
import { clanFetch } from '@/lib/clanFetch';

interface WebhookFieldProps {
  // Which settings key this field reads/writes. Defaults to the master announcements webhook.
  settingKey?: string;
  label?: string;
  helpText?: string;
  // Channels the bot can post to (server-fetched once on the page and passed down). When the bot
  // isn't configured, `botEnabled` is false and only the paste field shows.
  channels: BroadcastChannel[];
  botEnabled: boolean;
}

// A webhook setting may hold multiple space/comma-separated URLs (round-robined at send time to
// dodge Discord's per-webhook rate limit). Mirrors parseWebhookUrls in lib/discord.ts.
function parseUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((u) => /^https:\/\/\S+/i.test(u));
}

// Show a webhook URL without leaking its full token in the UI.
function maskUrl(u: string): string {
  const m = /\/webhooks\/(\d+)\/(.+)$/.exec(u);
  if (!m) return u.length > 44 ? `${u.slice(0, 41)}…` : u;
  const [, id, token] = m;
  return `…/webhooks/${id.slice(-4)}/••••${token.slice(-4)}`;
}

type Msg = { type: 'success' | 'error'; text: string } | null;

export default function WebhookField({
  settingKey = 'discord_webhook_url',
  label = 'Discord channel',
  helpText = 'In Discord: the channel’s settings → Integrations → Webhooks → New Webhook → Copy Webhook URL. Paste it here and Anvil posts into that channel.',
  channels,
  botEnabled,
}: WebhookFieldProps) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelId, setChannelId] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingUrl, setTestingUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<Msg>(null);
  const [permCheck, setPermCheck] = useState<{
    ok: boolean;
    reason?: string;
  } | null>(null);
  const [checkingPerm, setCheckingPerm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        setUrls(parseUrls(data[settingKey]));
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [settingKey]);

  // Flat option list for the themed Select (no native <optgroup>). `channels` arrives pre-sorted
  // (category, then position) from listBotChannels(), so same-category channels stay grouped, and the
  // category rides along as a search keyword for the Select's filter box.
  const channelOptions = useMemo<SelectOption[]>(
    () =>
      channels.map((c) => ({
        value: c.id,
        label: `#${c.name}`,
        keywords: c.parentName ? [c.parentName] : undefined,
      })),
    [channels],
  );

  // Check the bot's Manage Webhooks permission for the picked channel, live, so we can flag a
  // channel the bot can't create in before the admin clicks — and skip the doomed attempt.
  useEffect(() => {
    if (!channelId || !botEnabled) {
      setPermCheck(null);
      return;
    }
    let cancelled = false;
    setCheckingPerm(true);
    setPermCheck(null);
    clanFetch(`/api/admin/discord/webhooks?channelId=${encodeURIComponent(channelId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled)
          setPermCheck({
            ok: !!d.ok,
            reason: typeof d.reason === 'string' ? d.reason : undefined,
          });
      })
      .catch(() => {
        // Inconclusive check → stay permissive; the create path still surfaces a 403 if denied.
        if (!cancelled) setPermCheck(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingPerm(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, botEnabled]);

  const canCreate = botEnabled && channels.length > 0;
  // Only block when the check is conclusively negative; a null check (error/loading) stays permissive.
  const blockedByPerm = !!permCheck && !permCheck.ok;

  // Persist the full URL list to the settings key. Used by paste + remove; the bot-create route
  // persists server-side and returns the new list directly.
  async function saveList(next: string[]): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [settingKey]: next.join(' ') }),
      });
      if (res.ok) {
        setUrls(next);
        invalidateSettings();
        return true;
      }
      const data = await res.json().catch(() => ({}));
      setMessage({ type: 'error', text: data.error || 'Failed to save.' });
      return false;
    } catch {
      setMessage({ type: 'error', text: 'Failed to save.' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function create(mode: 'replace' | 'append') {
    if (!channelId) {
      setMessage({ type: 'error', text: 'Pick a channel first.' });
      return;
    }
    setCreating(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/discord/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, settingKey, mode, name: 'Anvil' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUrls(Array.isArray(data.urls) ? data.urls : []);
        invalidateSettings();
        setMessage({
          type: 'success',
          text: mode === 'replace' ? 'Done — Anvil will post there.' : 'Added — busy posts are shared across both.',
        });
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Couldn’t set that channel up. Try again.',
        });
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Couldn’t set that channel up. Try again.',
      });
    } finally {
      setCreating(false);
    }
  }

  async function addPasted() {
    const parsed = parseUrls(pasteInput);
    if (!parsed.length) {
      setMessage({
        type: 'error',
        text: 'That doesn’t look like a Discord channel link.',
      });
      return;
    }
    const next = Array.from(new Set([...urls, ...parsed]));
    if (await saveList(next)) {
      setPasteInput('');
      setMessage({ type: 'success', text: 'Saved.' });
    }
  }

  async function removeUrl(u: string) {
    await saveList(urls.filter((x) => x !== u));
  }

  async function test(u: string) {
    setTestingUrl(u);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', webhook_url: u }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? { type: 'success', text: data.message || 'Test message sent!' }
          : { type: 'error', text: data.error || 'Test failed.' },
      );
    } catch {
      setMessage({ type: 'error', text: 'Test failed.' });
    } finally {
      setTestingUrl(null);
    }
  }

  if (loading) return <div className="text-text-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-medium">{label}</p>}

      {/* Configured webhook(s) */}
      {urls.length > 0 ? (
        <ul className="space-y-1.5">
          {urls.map((u) => (
            <li key={u} className="flex items-center gap-2 bg-bg border border-card-border rounded-lg px-2.5 py-1.5">
              <code className="text-xs text-text-muted truncate flex-1">{maskUrl(u)}</code>
              <button
                onClick={() => test(u)}
                disabled={testingUrl === u}
                className="text-xs px-2 py-1 rounded-md border border-card-border hover:border-gold/40 transition-colors disabled:opacity-50"
              >
                {testingUrl === u ? 'Testing…' : 'Test'}
              </button>
              <button
                onClick={() => removeUrl(u)}
                disabled={saving}
                aria-label="Stop posting here"
                className="text-xs px-2 py-1 rounded-md text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">
          Not set — {canCreate ? 'pick a channel below.' : 'paste a channel link below.'}
        </p>
      )}

      {/* Create with the bot */}
      {canCreate && (
        <div className="rounded-lg border border-card-border bg-bg/40 p-3 space-y-2">
          <p className="text-xs font-medium">Pick a channel</p>
          <div className="flex flex-wrap gap-2">
            <Select
              value={channelId}
              onChange={setChannelId}
              options={channelOptions}
              placeholder="Select a channel…"
              ariaLabel="Channel"
              className="flex-1 min-w-[12rem]"
            />
          </div>
          {channelId &&
            (checkingPerm ? (
              <p className="text-[11px] text-text-muted">Checking bot permissions…</p>
            ) : blockedByPerm ? (
              <p className="text-[11px] text-red-400">✕ {permCheck?.reason || "Anvil can't post here."}</p>
            ) : permCheck?.ok ? (
              <p className="text-[11px] text-green-400">✓ Anvil can post here.</p>
            ) : null)}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => create('replace')}
              disabled={creating || !channelId || blockedByPerm}
              className="px-3 py-1.5 bg-gold text-bg font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Working…' : 'Post here'}
            </button>
            {urls.length > 0 && (
              <button
                onClick={() => create('append')}
                disabled={creating || !channelId || blockedByPerm}
                className="px-3 py-1.5 bg-card-bg-hover border border-card-border text-text font-semibold rounded-lg text-sm hover:border-gold/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add another
              </button>
            )}
          </div>
          <p className="text-[11px] text-text-muted">
            Anvil can&apos;t post somewhere? In Discord, give its role <em>Manage Webhooks</em> on that channel.
            {urls.length > 0 && (
              <>
                {' '}
                <strong>Add another</strong> shares busy posts across two channels.
              </>
            )}
          </p>
        </div>
      )}

      {/* Paste an existing link — the only way without the bot, tucked away when the bot can do it */}
      <details open={!canCreate} className="group">
        {canCreate && (
          <summary className="cursor-pointer text-[11px] text-text-muted hover:text-foreground">
            Or paste a link instead
          </summary>
        )}
        <div className={canCreate ? 'pt-2' : undefined}>
          <div className="flex gap-2">
            <Input
              type="url"
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="flex-1 px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
            />
            <button
              onClick={addPasted}
              disabled={saving || !pasteInput.trim()}
              className="px-3 py-2 bg-card-bg-hover border border-card-border text-text font-semibold rounded-lg text-sm hover:border-gold/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
          {helpText && <p className="text-xs text-text-muted mt-1">{helpText}</p>}
        </div>
      </details>

      {!botEnabled && (
        <p className="text-[11px] text-text-muted">
          Tip: add the Anvil bot under <span className="text-foreground/70">Connection</span> at the top of this page
          and you can just pick a channel instead of pasting links.
        </p>
      )}

      {/* A configured bot with zero listable channels almost always means it was never invited to
          the server (or can't see any channel there) — say so instead of showing an empty picker. */}
      {botEnabled && channels.length === 0 && (
        <p className="text-[11px] text-yellow-400">
          A bot is configured but Anvil can&apos;t see any channels in your server — it probably hasn&apos;t been
          invited yet. Open{' '}
          <ClanLink href="/admin/integrations" className="text-gold hover:underline">
            Discord → Connection
          </ClanLink>
          , where you can add it in one click.
        </p>
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
    </div>
  );
}
