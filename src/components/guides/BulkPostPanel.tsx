'use client';

import { useEffect, useMemo, useState } from 'react';

import Input from '@/components/Input';
import Select from '@/components/Select';
import Checkbox from '@/components/Checkbox';
import ClanLink from '@/components/ClanLink';
import { clanFetch } from '@/lib/clanFetch';
import { categoryOf, type CategoryView } from '@/lib/guideCategories';

interface GuideRow {
  id: number;
  title: string;
  category: string;
  status: string;
}

interface Channel {
  id: string;
  name: string;
  kind: 'text' | 'forum';
  parentName: string | null;
  requiresTag: boolean;
  missing: string[];
}

interface Bot {
  inGuild: boolean | null;
  reason?: string;
  canCreateChannels: boolean;
  canSetPermissions: boolean;
  missingForReadOnly: string[];
}

interface Result {
  ok: boolean;
  error?: string;
  results: { guideId: number; title: string; ok: boolean; error?: string }[];
}

type Layout = 'channels' | 'forum' | 'existing';

const LAYOUTS: { key: Layout; title: string; blurb: string }[] = [
  { key: 'channels', title: 'A channel per guide', blurb: 'A new category with one text channel for each guide.' },
  { key: 'forum', title: 'A guides forum', blurb: 'One new forum, each guide its own post, tagged by category.' },
  { key: 'existing', title: 'An existing channel', blurb: 'Every guide, one after another, in a channel or forum you have.' },
];

/**
 * Post many guides at once. The pre-flight (is the bot in the server, what may it do) is loaded
 * when the panel opens and shown as a checklist, so a missing permission is visible — and blocks the
 * button — before anything is created.
 */
export default function BulkPostPanel({
  guides,
  guideCategories,
  onClose,
  onDone,
}: {
  guides: GuideRow[];
  /** Guide categories (for icons) — not Discord categories, which this panel also lists. */
  guideCategories?: CategoryView[];
  onClose: () => void;
  onDone: () => void;
}) {
  const published = useMemo(() => guides.filter((g) => g.status === 'published'), [guides]);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(published.map((g) => g.id)));
  const [layout, setLayout] = useState<Layout>('channels');
  const [categoryName, setCategoryName] = useState('📖 Guides');
  const [parentId, setParentId] = useState('');
  const [forumName, setForumName] = useState('guides');
  const [channelId, setChannelId] = useState('');
  const [readOnly, setReadOnly] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(true);

  const [bot, setBot] = useState<Bot | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await clanFetch('/api/admin/guides/channels');
      const j = await res.json().catch(() => ({}));
      if (!alive) return;
      if (!res.ok) return setLoadError(j.error ?? 'Could not reach Discord');
      setEnabled(j.enabled !== false);
      setBot(j.bot ?? null);
      setChannels(j.channels ?? []);
      setCategories(j.categories ?? []);
      if (j.error) setLoadError(j.error);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const target = channels.find((c) => c.id === channelId);
  const creating = layout !== 'existing';

  // The checklist, in the order the bot would hit them.
  const checks: { ok: boolean; label: string; hint?: string }[] = [];
  if (bot) {
    checks.push({ ok: bot.inGuild === true, label: 'Bot is in your Discord server', hint: bot.reason });
    if (creating) {
      checks.push({ ok: bot.canCreateChannels, label: 'Can create channels', hint: 'Give the bot "Manage Channels".' });
      if (readOnly) {
        checks.push({ ok: bot.canSetPermissions, label: 'Can make them read-only', hint: 'Give the bot "Manage Roles", or untick read-only.' });
        if (bot.missingForReadOnly.length) {
          checks.push({ ok: false, label: 'Can keep its own access', hint: `The bot needs ${bot.missingForReadOnly.join(', ')} server-wide.` });
        }
      }
    } else if (target) {
      checks.push({
        ok: target.missing.length === 0 && !(target.kind === 'forum' && target.requiresTag),
        label: `Can post in #${target.name}`,
        hint: target.missing.length
          ? `Missing ${target.missing.join(', ')} there.`
          : 'That forum requires a tag on every post — use a new forum instead.',
      });
    }
  }
  const blocked =
    !enabled ||
    !bot ||
    checks.some((c) => !c.ok) ||
    picked.size === 0 ||
    (layout === 'existing' && !channelId) ||
    (layout === 'channels' && !parentId && !categoryName.trim());

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await clanFetch('/api/admin/guides/bulk-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guideIds: published.filter((g) => picked.has(g.id)).map((g) => g.id),
          layout,
          categoryName,
          parentId: parentId || null,
          forumName,
          channelId,
          readOnly: creating && readOnly,
          autoUpdate,
        }),
      });
      const j = (await res.json().catch(() => ({ ok: false, error: 'Bad response', results: [] }))) as Result;
      setResult(j);
      if (j.results?.some((r) => r.ok)) onDone();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#5865f2]/50 bg-card-bg p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">Post guides to Discord</h2>
        <button onClick={onClose} className="text-xs text-text-muted hover:text-foreground">
          Close
        </button>
      </div>

      {!enabled ? (
        <p className="text-sm text-text-muted">
          Connect the Discord bot first —{' '}
          <ClanLink href="/admin/integrations" className="text-gold hover:underline">
            Settings → Discord
          </ClanLink>
          .
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          {/* Which guides */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-text-muted">
              <span>
                {picked.size} of {published.length} published guides
              </span>
              <button
                onClick={() => setPicked(picked.size === published.length ? new Set() : new Set(published.map((g) => g.id)))}
                className="text-gold hover:underline"
              >
                {picked.size === published.length ? 'None' : 'All'}
              </button>
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-card-border p-2">
              {published.map((g) => (
                <Checkbox
                  key={g.id}
                  checked={picked.has(g.id)}
                  onChange={(on) =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (on) n.add(g.id);
                      else n.delete(g.id);
                      return n;
                    })
                  }
                  label={`${categoryOf(g.category, guideCategories).icon} ${g.title}`}
                  labelClassName="text-sm"
                />
              ))}
              {published.length === 0 && <p className="p-2 text-xs text-text-muted">No published guides yet.</p>}
            </div>
            {guides.length > published.length && (
              <p className="mt-1 text-[11px] text-text-muted">Drafts are left out — publish them to post them.</p>
            )}
          </div>

          {/* Where */}
          <div className="space-y-3">
            <div className="grid gap-2">
              {LAYOUTS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLayout(l.key)}
                  className={`rounded-lg border px-3 py-2 text-left ${
                    layout === l.key ? 'border-gold bg-gold/10' : 'border-card-border hover:border-gold/40'
                  }`}
                >
                  <div className="text-sm font-semibold">{l.title}</div>
                  <div className="text-xs text-text-muted">{l.blurb}</div>
                </button>
              ))}
            </div>

            {creating && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs text-text-muted">Category</span>
                  <Select
                    value={parentId}
                    onChange={setParentId}
                    options={[
                      { value: '', label: layout === 'forum' ? 'New category (or none, if left blank below)' : 'New category' },
                      ...categories.map((c) => ({ value: c.id, label: `Existing: ${c.name}` })),
                    ]}
                    ariaLabel="Category"
                  />
                </label>
                {!parentId && (
                  <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="New category name" maxLength={100} />
                )}
                {layout === 'forum' && (
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">Forum name</span>
                    <Input value={forumName} onChange={(e) => setForumName(e.target.value)} maxLength={100} />
                  </label>
                )}
                <Checkbox
                  checked={readOnly}
                  onChange={setReadOnly}
                  label="Read-only for members"
                  description={layout === 'forum' ? 'Members can reply inside a guide, but not start new posts.' : 'Only the bot writes in these channels.'}
                />
              </>
            )}

            {layout === 'existing' && (
              <Select
                value={channelId}
                onChange={setChannelId}
                searchable
                placeholder="Pick a channel or forum…"
                options={channels.map((c) => ({
                  value: c.id,
                  label: `${c.kind === 'forum' ? '🗂 ' : '# '}${c.name}${c.parentName ? ` · ${c.parentName}` : ''}${
                    c.missing.length ? ` — bot lacks ${c.missing.join(', ')}` : ''
                  }`,
                  disabled: c.missing.length > 0,
                }))}
                ariaLabel="Channel"
              />
            )}

            <Checkbox checked={autoUpdate} onChange={setAutoUpdate} label="Keep them updated" description="Guide edits are mirrored into Discord." />

            <ul className="space-y-1 rounded-lg bg-black/20 p-3 text-xs">
              {!bot && !loadError && <li className="text-text-muted">Checking the bot…</li>}
              {loadError && !bot?.inGuild && <li className="text-red-300">✗ {loadError}</li>}
              {checks.map((c) => (
                <li key={c.label} className={c.ok ? 'text-emerald-300' : 'text-red-300'}>
                  {c.ok ? '✓' : '✗'} {c.label}
                  {!c.ok && c.hint && <span className="text-text-muted"> — {c.hint}</span>}
                </li>
              ))}
            </ul>

            <button
              onClick={run}
              disabled={blocked || running}
              className="w-full rounded-lg bg-[#5865f2] px-3 py-2 text-sm font-semibold text-white hover:bg-[#4752c4] disabled:opacity-40"
            >
              {running ? `Posting ${picked.size} guides… this can take a minute` : `Post ${picked.size} guide${picked.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-card-border p-3 text-sm">
          {result.error && <p className="mb-2 text-red-300">{result.error}</p>}
          <ul className="space-y-1 text-xs">
            {result.results.map((r) => (
              <li key={r.guideId} className={r.ok ? 'text-emerald-300' : 'text-red-300'}>
                {r.ok ? '✓' : '✗'} {r.title}
                {r.error && <span className="text-text-muted"> — {r.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
