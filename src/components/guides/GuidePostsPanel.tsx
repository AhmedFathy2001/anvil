'use client';

import { useState } from 'react';

import ClanLink from '@/components/ClanLink';
import Select from '@/components/Select';
import Checkbox from '@/components/Checkbox';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';

export interface PostRow {
  id: number;
  channelId: string;
  channelName: string | null;
  channelKind: string;
  threadId: string | null;
  messageIds: string[];
  postedVersion: number;
  autoUpdate: boolean;
  lastError: string | null;
  updatedAt: string;
  jumpUrl: string | null;
}

interface Channel {
  id: string;
  name: string;
  kind: 'text' | 'forum';
  parentName: string | null;
  tags: { id: string; name: string; emoji: string | null }[];
  requiresTag: boolean;
}

/** Where this guide lives in Discord, and posting it somewhere new. Clan guides only. */
export default function GuidePostsPanel({
  guideId,
  guideVersion,
  published,
  dirty,
  readOnly,
  botConnected,
  posts,
  onChange,
}: {
  guideId: number;
  guideVersion: number;
  published: boolean;
  dirty: boolean;
  readOnly: boolean;
  botConnected: boolean;
  posts: PostRow[];
  onChange: () => Promise<void> | void;
}) {
  const { confirm, notify } = useDialog();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function loadChannels() {
    setOpen(true);
    if (channels) return;
    const res = await clanFetch('/api/admin/guides/channels');
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setChannelError(j.error ?? 'Could not load channels');
    setChannels(j.channels ?? []);
    if (j.error) setChannelError(j.error);
  }

  const channel = channels?.find((c) => c.id === channelId) ?? null;

  async function post() {
    if (!channelId) return;
    setBusy('post');
    try {
      const res = await clanFetch(`/api/admin/guides/${guideId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, tagIds, autoUpdate }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return notify(j.error ?? 'Posting failed', 'error');
      notify(`Posted to #${channel?.name ?? 'channel'}`);
      setOpen(false);
      setChannelId('');
      setTagIds([]);
      await onChange();
    } finally {
      setBusy(null);
    }
  }

  async function patch(p: PostRow, body: Record<string, unknown>, label: string) {
    setBusy(`${p.id}:${label}`);
    try {
      const res = await clanFetch(`/api/admin/guides/${guideId}/posts/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) notify(j.error ?? 'Failed', 'error');
      else if (body.resync) notify('Discord updated');
      await onChange();
    } finally {
      setBusy(null);
    }
  }

  async function unpost(p: PostRow) {
    const del = await confirm({
      title: `Remove from #${p.channelName ?? 'channel'}?`,
      body:
        p.channelKind === 'forum'
          ? 'Deletes the forum post (and any replies in it) from Discord.'
          : `Deletes the ${p.messageIds.length} message${p.messageIds.length === 1 ? '' : 's'} the bot posted.`,
      confirmLabel: 'Delete from Discord',
      tone: 'danger',
    });
    if (!del) return;
    setBusy(`${p.id}:del`);
    try {
      const res = await clanFetch(`/api/admin/guides/${guideId}/posts/${p.id}?discord=1`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The messages may already be gone by hand; offer to just forget the post.
        const forget = await confirm({
          title: 'Discord refused the delete',
          body: `${j.error ?? 'Unknown error'}\n\nStop tracking this post in Anvil anyway? (Nothing more is deleted.)`,
          confirmLabel: 'Stop tracking',
        });
        if (forget) await clanFetch(`/api/admin/guides/${guideId}/posts/${p.id}`, { method: 'DELETE' });
      }
      await onChange();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span aria-hidden className="h-4 w-1 rounded-full bg-gold" /> In Discord
        </h2>
        {!readOnly && botConnected && !open && (
          <button
            onClick={loadChannels}
            disabled={!published || dirty}
            title={!published ? 'Publish first' : dirty ? 'Save first' : undefined}
            className="rounded-lg bg-[#5865f2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4752c4] disabled:opacity-40"
          >
            Post to Discord
          </button>
        )}
      </div>

      {!botConnected && (
        <p className="text-xs text-text-muted">
          Connect the Discord bot to post guides —{' '}
          <ClanLink href="/admin/integrations" className="text-gold hover:underline">
            Settings → Discord
          </ClanLink>
          .
        </p>
      )}
      {botConnected && (!published || dirty) && !posts.length && (
        <p className="text-xs text-text-muted">{!published ? 'Publish the guide to post it.' : 'Save your changes to post.'}</p>
      )}

      {open && (
        <div className="mb-4 space-y-3 rounded-lg border border-card-border bg-black/20 p-3">
          {channelError && <p className="text-xs text-red-300">{channelError}</p>}
          {!channels ? (
            <p className="text-xs text-text-muted">Loading channels…</p>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">Channel or forum</span>
                <Select
                  value={channelId}
                  onChange={(v) => {
                    setChannelId(v);
                    setTagIds([]);
                  }}
                  searchable
                  placeholder="Pick where it goes…"
                  options={channels.map((c) => ({
                    value: c.id,
                    label: `${c.kind === 'forum' ? '🗂 ' : '# '}${c.name}${c.parentName ? ` · ${c.parentName}` : ''}`,
                    keywords: [c.name, c.parentName ?? ''],
                  }))}
                  ariaLabel="Channel"
                />
              </label>
              {channel?.kind === 'forum' && (
                <div>
                  <p className="mb-1 text-xs text-text-muted">
                    Opens a new forum post named after the guide.{' '}
                    {channel.tags.length > 0 && (channel.requiresTag ? 'This forum requires a tag:' : 'Tags (optional):')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {channel.tags.map((t) => {
                      const on = tagIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTagIds((ids) => (on ? ids.filter((x) => x !== t.id) : [...ids, t.id].slice(0, 5)))}
                          className={`rounded-full border px-2.5 py-0.5 text-xs ${
                            on ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'
                          }`}
                        >
                          {t.emoji ? `${t.emoji} ` : ''}
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <Checkbox
                checked={autoUpdate}
                onChange={setAutoUpdate}
                label="Keep it updated"
                description="When the guide changes, the bot edits these messages to match."
              />
              <div className="flex gap-2">
                <button
                  onClick={post}
                  disabled={!channelId || busy === 'post' || (channel?.requiresTag === true && tagIds.length === 0)}
                  className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-40"
                >
                  {busy === 'post' ? 'Posting…' : 'Post'}
                </button>
                <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:text-foreground">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {posts.length > 0 ? (
        <ul className="divide-y divide-card-border">
          {posts.map((p) => {
            const current = p.postedVersion === guideVersion && !p.lastError;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">{p.channelKind === 'forum' ? '🗂' : '#'}</span>
                    <span className="truncate font-medium">{p.channelName ?? p.channelId}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        current ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'
                      }`}
                    >
                      {current ? 'up to date' : p.lastError ? 'needs attention' : `shows v${p.postedVersion}`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {p.messageIds.length} message{p.messageIds.length === 1 ? '' : 's'} · {p.autoUpdate ? 'auto-updates' : 'frozen snapshot'}
                  </p>
                  {p.lastError && <p className="mt-1 text-[11px] text-red-300">{p.lastError}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {p.jumpUrl && (
                    <a href={p.jumpUrl} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                      Open ↗
                    </a>
                  )}
                  {!readOnly && (
                    <>
                      <Checkbox
                        checked={p.autoUpdate}
                        onChange={(v) => patch(p, { autoUpdate: v }, 'auto')}
                        disabled={busy != null}
                        label="Auto-update"
                        labelClassName="text-xs"
                      />
                      <button
                        onClick={() => patch(p, { resync: true }, 'sync')}
                        disabled={busy != null || dirty}
                        title={dirty ? 'Save first' : 'Re-send the current version to Discord'}
                        className="rounded border border-card-border px-2 py-1 hover:text-gold disabled:opacity-40"
                      >
                        {busy === `${p.id}:sync` ? 'Updating…' : 'Update now'}
                      </button>
                      <button
                        onClick={() => unpost(p)}
                        disabled={busy != null}
                        className="rounded border border-red-950 px-2 py-1 text-red-300 hover:bg-red-950/40 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        botConnected && published && !dirty && !open && <p className="text-xs text-text-muted">Not posted anywhere yet.</p>
      )}
    </section>
  );
}
