'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface Channel {
  id: string;
  name: string;
  parentName: string | null;
  position: number;
}
interface Role {
  id: string;
  name: string;
  isEveryone: boolean;
}
interface Targets {
  enabled: boolean;
  channels: Channel[];
  roles: Role[];
}

export default function AnnounceClient() {
  const [targets, setTargets] = useState<Targets | null>(null);
  const [loading, setLoading] = useState(true);

  const [channelId, setChannelId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [asEmbed, setAsEmbed] = useState(true);
  const [colorHex, setColorHex] = useState('#e0b341');
  const [mentionRoleId, setMentionRoleId] = useState('');

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/discord/broadcast');
        if (res.ok) setTargets(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Group channels under their category for a readable <optgroup> picker.
  const grouped = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const c of targets?.channels ?? []) {
      const key = c.parentName ?? 'No category';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries());
  }, [targets]);

  async function send() {
    if (!channelId) {
      setMessage({ type: 'error', text: 'Pick a channel first.' });
      return;
    }
    if (!body.trim()) {
      setMessage({ type: 'error', text: 'Write a message first.' });
      return;
    }

    const channelName = targets?.channels.find((c) => c.id === channelId)?.name ?? 'that channel';
    const roleName = mentionRoleId ? targets?.roles.find((r) => r.id === mentionRoleId)?.name : null;
    const confirmText = `Send this message to #${channelName}${roleName ? `, pinging @${roleName}` : ''}?`;
    if (!confirm(confirmText)) return;

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/discord/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          title: title.trim() || undefined,
          body,
          asEmbed,
          colorHex,
          mentionRoleId: mentionRoleId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const n = data.report?.messagesSent ?? 1;
        setMessage({
          type: 'success',
          text: `Sent to #${channelName}${n > 1 ? ` as ${n} messages (long text was split)` : ''}. ✓`,
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Send failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Send failed' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-text-muted text-sm">Loading…</p>;

  // Bot not wired up — point them at the one place that configures it.
  if (!targets?.enabled) {
    return (
      <div className="border border-card-border rounded-xl p-5 bg-card-bg">
        <p className="text-sm mb-2">The Discord bot isn’t configured yet.</p>
        <p className="text-xs text-text-muted mb-4">
          This tool posts as the bot, so it needs a bot token in the environment (<code>DISCORD_BOT_TOKEN</code>)
          and your server ID. Set the server ID under Integrations → Discord roles &amp; nicknames.
        </p>
        <Link href="/admin/integrations" className="text-sm text-gold hover:underline">
          Go to Integrations →
        </Link>
      </div>
    );
  }

  const inputClass =
    'w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold/50';

  return (
    <div className="border border-card-border rounded-xl p-5 bg-card-bg space-y-5">
      {/* Channel */}
      <div>
        <label className="block text-sm font-medium mb-1">Channel</label>
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={inputClass}>
          <option value="">Select a channel…</option>
          {grouped.map(([category, channels]) => (
            <optgroup key={category} label={category}>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {targets.channels.length === 0 && (
          <p className="text-xs text-red-400 mt-1">
            The bot can’t see any text channels — check it’s in the server and has “View Channel”.
          </p>
        )}
      </div>

      {/* Title (embed only) */}
      {asEmbed && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Title <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bingo Rules"
            maxLength={256}
            className={inputClass}
          />
        </div>
      )}

      {/* Body */}
      <div>
        <label className="block text-sm font-medium mb-1">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          placeholder="Paste your rules or announcement here. Long messages are split automatically."
          className={`${inputClass} font-mono resize-y`}
        />
        <p className="text-xs text-text-muted mt-1">{body.length.toLocaleString()} characters</p>
      </div>

      {/* Options */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={asEmbed} onChange={(e) => setAsEmbed(e.target.checked)} className="accent-gold" />
          Send as an embed
        </label>

        {asEmbed && (
          <label className="flex items-center gap-2 text-sm">
            <span>Accent colour</span>
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              className="h-7 w-10 bg-transparent border border-card-border rounded cursor-pointer"
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-sm">
          <span>Ping</span>
          <select value={mentionRoleId} onChange={(e) => setMentionRoleId(e.target.value)} className={`${inputClass} w-auto py-1.5`}>
            <option value="">No ping</option>
            {targets.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.isEveryone ? '@everyone' : `@${r.name}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={send}
          disabled={busy || !channelId || !body.trim()}
          className="text-sm font-medium bg-gold/15 text-gold border border-gold/30 px-5 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send message'}
        </button>

        {message && (
          <span
            className={`text-sm px-3 py-1.5 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
