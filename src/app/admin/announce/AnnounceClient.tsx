'use client';

import { useEffect, useMemo, useState } from 'react';
import Select, { type SelectOption } from '@/components/Select';
import Checkbox from '@/components/Checkbox';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import { useDialog } from '@/components/Confirm';

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
interface Broadcast {
  id: number;
  channelId: string;
  messageIds: string[];
  title: string | null;
  body: string;
  asEmbed: boolean;
  colorHex: string | null;
  mentionRoleId: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
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
  const { confirm } = useDialog();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Editing a past post: its id, while the form holds its text.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);

  async function loadHistory() {
    const res = await clanFetch('/api/admin/discord/broadcast?history=1');
    if (res.ok) setHistory(((await res.json()) as { history: Broadcast[] }).history ?? []);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await clanFetch('/api/admin/discord/broadcast');
        if (res.ok) setTargets(await res.json());
      } finally {
        setLoading(false);
      }
    })();
    void loadHistory();
  }, []);

  function startEdit(b: Broadcast) {
    setEditingId(b.id);
    setChannelId(b.channelId);
    setTitle(b.title ?? '');
    setBody(b.body);
    setAsEmbed(b.asEmbed);
    if (b.colorHex) setColorHex(b.colorHex);
    setMentionRoleId(b.mentionRoleId ?? '');
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function stopEdit() {
    setEditingId(null);
    setTitle('');
    setBody('');
    setMentionRoleId('');
  }

  async function saveEdit() {
    if (editingId == null || !body.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/discord/broadcast/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined, body, asEmbed, colorHex }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The edit did not go through.');
      setMessage({ type: 'success', text: 'Updated in Discord. ✓' });
      stopEdit();
      void loadHistory();
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: Broadcast) {
    const ok = await confirm({
      title: 'Delete this post from Discord?',
      body: 'It disappears from the channel for everyone. This can’t be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await clanFetch(`/api/admin/discord/broadcast/${b.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete it.');
      if (editingId === b.id) stopEdit();
      void loadHistory();
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  // Channel + role options for the themed Select. Channels arrive pre-sorted (category, then
  // position), so same-category channels stay grouped; the category rides along as a search keyword.
  const channelOptions = useMemo<SelectOption[]>(
    () =>
      (targets?.channels ?? []).map((c) => ({
        value: c.id,
        label: `#${c.name}`,
        keywords: c.parentName ? [c.parentName] : undefined,
      })),
    [targets],
  );
  const roleOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'No ping' },
      ...(targets?.roles ?? []).map((r) => ({
        value: r.id,
        label: r.isEveryone ? '@everyone' : `@${r.name}`,
      })),
    ],
    [targets],
  );

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
    const ok = await confirm({
      title: `Send to #${channelName}?`,
      body: roleName
        ? `Everyone with @${roleName} is pinged. You can edit or delete it afterwards from the list below.`
        : 'You can edit or delete it afterwards from the list below.',
      confirmLabel: 'Send',
      tone: 'gold',
    });
    if (!ok) return;

    setBusy(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/discord/broadcast', {
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
        void loadHistory();
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
        <p className="text-sm mb-2">Your Discord server isn’t connected yet.</p>
        <p className="text-xs text-text-muted mb-4">
          This posts as Anvil’s bot, so it needs your server connected first. It takes one button on the
          Discord page.
        </p>
        <ClanLink href="/admin/integrations" className="text-sm text-gold hover:underline">
          Go to Discord →
        </ClanLink>
      </div>
    );
  }

  const inputClass =
    'w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold/50';

  const channelLabel = (id: string) => `#${targets.channels.find((c) => c.id === id)?.name ?? 'deleted channel'}`;

  return (
    <div className="space-y-6">
    <div className="border border-card-border rounded-xl p-5 bg-card-bg space-y-5">
      {editingId != null && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm">
          <span>Editing a post in {channelLabel(channelId)}. Saving updates it in Discord; it won’t ping again.</span>
          <button type="button" onClick={stopEdit} className="ml-auto text-text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      )}
      {/* Channel */}
      <div>
        <label className="block text-sm font-medium mb-1">Channel</label>
        <Select
          value={channelId}
          onChange={setChannelId}
          options={channelOptions}
          placeholder="Select a channel…"
          ariaLabel="Channel"
          disabled={editingId != null}
        />
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
          <Input
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
        <Checkbox checked={asEmbed} onChange={setAsEmbed} label="Send as an embed" />

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

        <div className="flex items-center gap-2 text-sm">
          <span>Ping</span>
          <Select
            value={mentionRoleId}
            onChange={setMentionRoleId}
            options={roleOptions}
            ariaLabel="Ping role"
            className="min-w-[10rem]"
            disabled={editingId != null}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={editingId != null ? saveEdit : send}
          disabled={busy || !channelId || !body.trim()}
          className="text-sm font-medium bg-gold/15 text-gold border border-gold/30 px-5 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50"
        >
          {editingId != null ? (busy ? 'Saving…' : 'Save changes') : busy ? 'Sending…' : 'Send message'}
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

    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Sent from here
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-text-muted">Nothing yet. Everything you send shows up here, ready to edit or delete.</p>
      ) : (
        <ul className="divide-y divide-card-border-soft rounded-xl border border-card-border bg-card-bg">
          {history.map((b) => (
            <li key={b.id} className={`flex flex-wrap items-start gap-3 px-4 py-3 ${b.deletedAt ? 'opacity-60' : ''}`}>
              <div className="min-w-0 flex-[1_1_320px]">
                <div className="text-sm font-medium">{b.title || b.body.split('\n')[0].slice(0, 80) || 'Untitled'}</div>
                <div className="text-xs text-text-muted">
                  {channelLabel(b.channelId)} · {new Date(b.createdAt).toLocaleString()}
                  {b.messageIds.length > 1 ? ` · ${b.messageIds.length} messages` : ''}
                  {b.editedAt ? ' · edited' : ''}
                  {b.deletedAt ? ' · deleted' : ''}
                </div>
              </div>
              {!b.deletedAt && (
                <div className="flex gap-3 text-sm">
                  <button type="button" disabled={busy} onClick={() => startEdit(b)} className="text-text-muted hover:text-gold disabled:opacity-50">
                    Edit
                  </button>
                  <button type="button" disabled={busy} onClick={() => void remove(b)} className="text-text-muted hover:text-accent-red disabled:opacity-50">
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
    </div>
  );
}
