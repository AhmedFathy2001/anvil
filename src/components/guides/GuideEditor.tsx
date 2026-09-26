'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';
import Select from '@/components/Select';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';
import { GUIDE_CATEGORIES, GUIDE_LIMITS, readingMinutes } from '@/lib/guideCategories';
import { renderGuide } from '@/lib/guideMarkdown';
import DiscordPreview from './DiscordPreview';
import GuideDiffView from './GuideDiffView';
import GuidePostsPanel, { type PostRow } from './GuidePostsPanel';

type Scope = 'clan' | 'library';

interface GuideRow {
  id: number;
  clanId: number | null;
  slug: string;
  title: string;
  summary: string;
  category: string;
  coverUrl: string | null;
  body: string;
  status: string;
  version: number;
  sourceGuideId: number | null;
  sourceVersion: number | null;
  followsSource: boolean;
  updatedAt: string;
}

interface Loaded {
  canEdit: boolean;
  guide: GuideRow;
  revisions: { version: number; note: string | null; at: string }[];
  source?: { id: number; title: string; summary: string; body: string; version: number; status: string; updatedAt: string } | null;
  sourceNotes?: { version: number; note: string | null; at: string }[];
  posts?: PostRow[];
  botConnected?: boolean;
  copies?: { following: number; forked: number };
}

type Form = Pick<GuideRow, 'title' | 'summary' | 'category' | 'coverUrl' | 'body' | 'status' | 'slug'>;

const pick = (g: GuideRow): Form => ({
  title: g.title,
  summary: g.summary,
  category: g.category,
  coverUrl: g.coverUrl,
  body: g.body,
  status: g.status,
  slug: g.slug,
});

/** Toolbar actions: wrap the selection, or prefix every selected line. */
type Tool =
  | { label: string; title: string; wrap: [string, string]; placeholder: string }
  | { label: string; title: string; prefix: string | ((i: number) => string) }
  | { label: string; title: string; insert: string };

const TOOLS: Tool[] = [
  { label: 'B', title: 'Bold', wrap: ['**', '**'], placeholder: 'bold' },
  { label: 'I', title: 'Italic', wrap: ['*', '*'], placeholder: 'italic' },
  { label: 'U', title: 'Underline', wrap: ['__', '__'], placeholder: 'underline' },
  { label: 'S', title: 'Strikethrough', wrap: ['~~', '~~'], placeholder: 'struck' },
  { label: '▮▮', title: 'Spoiler', wrap: ['||', '||'], placeholder: 'spoiler' },
  { label: '</>', title: 'Inline code', wrap: ['`', '`'], placeholder: 'code' },
  { label: 'H1', title: 'Big heading', prefix: '# ' },
  { label: 'H2', title: 'Heading', prefix: '## ' },
  { label: 'H3', title: 'Small heading', prefix: '### ' },
  { label: '-#', title: 'Subtext (small grey line)', prefix: '-# ' },
  { label: '•', title: 'Bulleted list', prefix: '- ' },
  { label: '1.', title: 'Numbered list', prefix: (i) => `${i + 1}. ` },
  { label: '❝', title: 'Quote', prefix: '> ' },
  { label: '🔗', title: 'Link', wrap: ['[', '](https://)'], placeholder: 'link text' },
  { label: '```', title: 'Code block', wrap: ['```\n', '\n```'], placeholder: 'code' },
  { label: '⎯ msg', title: 'Start a new Discord message here', insert: '\n---\n' },
];

export default function GuideEditor({
  scope,
  guideId,
  listHref,
  origin,
  siteHref,
  siteUrl,
}: {
  scope: Scope;
  guideId: number;
  listHref: string;
  origin: string | null;
  /** Where the published guide reads on the site (relative), for the "View" link. */
  siteHref: string;
  /** The same, absolute — what the Discord footer links to. */
  siteUrl: string | null;
}) {
  const router = useRouter();
  const { confirm, notify } = useDialog();
  const api = scope === 'clan' ? '/api/admin/guides' : '/api/staff/guides';
  // clanFetch for both: it prefixes the clan routes and passes /api/staff through untouched.
  const call = clanFetch;

  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<'discord' | 'site'>('discord');
  const [showDiff, setShowDiff] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await call(`${api}/${guideId}`);
    if (!res.ok) {
      setLoadError(res.status === 404 ? 'This guide no longer exists.' : `Could not load the guide (${res.status}).`);
      return;
    }
    const j = (await res.json()) as Loaded;
    setData(j);
    setForm(pick(j.guide));
    setNote('');
  }, [api, call, guideId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!data || !form) return false;
    const base = pick(data.guide);
    return (Object.keys(base) as (keyof Form)[]).some((k) => (base[k] ?? '') !== (form[k] ?? ''));
  }, [data, form]);

  // Leaving with unsaved edits loses them; say so.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save(extra?: Partial<Form>) {
    if (!form || !data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await call(`${api}/${guideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...extra, note: note.trim() || null, baseVersion: data.guide.version }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? `Save failed (${res.status})`);
        return;
      }
      notify('Saved');
      await load();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // ── Editing helpers ──────────────────────────────────────────────────────────────────────

  function applyTool(tool: Tool) {
    const ta = bodyRef.current;
    if (!ta || !form) return;
    const { selectionStart: a, selectionEnd: b, value } = ta;
    let next = value;
    let caretA = a;
    let caretB = b;
    if ('wrap' in tool) {
      const inner = value.slice(a, b) || tool.placeholder;
      next = value.slice(0, a) + tool.wrap[0] + inner + tool.wrap[1] + value.slice(b);
      caretA = a + tool.wrap[0].length;
      caretB = caretA + inner.length;
    } else if ('prefix' in tool) {
      const lineStart = value.lastIndexOf('\n', a - 1) + 1;
      const lineEnd = value.indexOf('\n', b) === -1 ? value.length : value.indexOf('\n', b);
      const block = value.slice(lineStart, lineEnd).split('\n');
      const out = block.map((l, i) => (typeof tool.prefix === 'function' ? tool.prefix(i) : tool.prefix) + l).join('\n');
      next = value.slice(0, lineStart) + out + value.slice(lineEnd);
      caretA = lineStart;
      caretB = lineStart + out.length;
    } else {
      next = value.slice(0, a) + tool.insert + value.slice(b);
      caretA = caretB = a + tool.insert.length;
    }
    set('body', next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caretA, caretB);
    });
  }

  function insertAtCaret(text: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: a, selectionEnd: b, value } = ta;
    // Images must sit on a line of their own to be images.
    const before = a > 0 && value[a - 1] !== '\n' ? '\n' : '';
    const after = value[b] !== '\n' ? '\n' : '';
    const ins = `${before}${text}${after}`;
    set('body', value.slice(0, a) + ins + value.slice(b));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(a + ins.length, a + ins.length);
    });
  }

  async function upload(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await call(`${api}/upload`, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(j.error ?? 'Upload failed', 'error');
        return null;
      }
      return j.url as string;
    } finally {
      setUploading(false);
    }
  }

  async function uploadImages(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const url = await upload(f);
      if (url) insertAtCaret(`![${f.name.replace(/\.[a-z0-9]+$/i, '')}](${url})`);
    }
  }

  // ── Library-update actions (clan copies) ─────────────────────────────────────────────────

  async function answerUpdate(action: 'sync' | 'dismiss') {
    if (action === 'sync' && data && !data.guide.followsSource) {
      const ok = await confirm({
        title: 'Take the library version?',
        body: 'Your copy is replaced with the current Anvil library text — your own edits to it are overwritten (they stay in this guide\'s history). From then on it follows the library again, and any Discord posts update to match.',
        confirmLabel: 'Take library version',
        tone: 'danger',
      });
      if (!ok) return;
    }
    const res = await call(`${api}/${guideId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return notify(j.error ?? 'Failed', 'error');
    notify(action === 'sync' ? 'Now matches the library' : 'Keeping your version');
    setShowDiff(false);
    await load();
    router.refresh();
  }

  async function remove() {
    if (!data) return;
    const hasPosts = (data.posts?.length ?? 0) > 0;
    const ok = await confirm({
      title: `Delete "${data.guide.title}"?`,
      body:
        scope === 'library'
          ? 'Clans that copied it keep their copies — they just stop receiving updates.'
          : hasPosts
            ? 'It will also be removed from the Discord channels it was posted to.'
            : 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const res = await call(`${api}/${guideId}${scope === 'clan' && hasPosts ? '?discord=1' : ''}`, { method: 'DELETE' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return notify(j.error ?? 'Delete failed', 'error');
    router.push(listHref);
    router.refresh();
  }

  if (loadError) return <p className="text-sm text-red-300">{loadError}</p>;
  if (!data || !form) return <p className="text-sm text-text-muted">Loading…</p>;

  const g = data.guide;
  const readOnly = !data.canEdit;
  const src = data.source;
  const isCopy = scope === 'clan' && g.sourceGuideId != null;
  const behind = isCopy && src && !g.followsSource && src.status === 'published' && src.version > (g.sourceVersion ?? 0);
  const previewGuide = {
    title: form.title,
    summary: form.summary,
    body: form.body,
    coverUrl: form.coverUrl,
    siteUrl,
    updatedAt: g.updatedAt,
    byline: scope === 'library' ? 'Anvil guide library' : null,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <ClanLink href={listHref} className="text-xs text-text-muted hover:text-gold">
            ← All guides
          </ClanLink>
          <h1 className="mt-1 truncate text-2xl font-bold text-gold">{form.title || 'Untitled guide'}</h1>
          <p className="mt-0.5 text-xs text-text-muted">
            v{g.version} · {form.status === 'published' ? 'Published' : 'Draft'} · {readingMinutes(form.body)} min read
            {scope === 'library' && data.copies && (
              <>
                {' '}
                · copied by {data.copies.following + data.copies.forked} clan
                {data.copies.following + data.copies.forked === 1 ? '' : 's'}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {g.status === 'published' && (
            <ClanLink
              href={siteHref}
              target="_blank"
              className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:text-foreground"
            >
              View ↗
            </ClanLink>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => save({ status: form.status === 'published' ? 'draft' : 'published' })}
              disabled={saving}
              className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:text-foreground disabled:opacity-50"
            >
              {form.status === 'published' ? 'Unpublish' : dirty ? 'Save & publish' : 'Publish'}
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => save()}
              disabled={saving || !dirty}
              className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-40"
            >
              {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</p>}
      {readOnly && (
        <p className="rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm text-text-muted">
          You can read this guide but not edit it. {scope === 'clan' ? 'An admin can give you guide editing under People → Staff.' : ''}
        </p>
      )}

      {/* Where this copy stands against the library */}
      {isCopy && g.followsSource && (
        <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          <span className="font-semibold">Follows the Anvil library.</span> Library updates land here — and in any Discord posts —
          automatically. Editing makes this copy yours: after that, updates wait for your OK.
        </div>
      )}
      {behind && src && (
        <div className="rounded-xl border border-amber-700/70 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-semibold">The library version was updated</span>{' '}
              <span className="text-amber-200/80">
                (you have v{g.sourceVersion ?? 0}, library is v{src.version})
              </span>
              {(data.sourceNotes ?? []).filter((n) => n.note).length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs text-amber-200/90">
                  {(data.sourceNotes ?? [])
                    .filter((n) => n.note)
                    .slice(0, 4)
                    .map((n) => (
                      <li key={n.version}>
                        v{n.version}: {n.note}
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowDiff((v) => !v)} className="rounded-lg border border-amber-700 px-3 py-1 text-xs hover:bg-amber-900/30">
                {showDiff ? 'Hide changes' : 'See what changed'}
              </button>
              {!readOnly && (
                <>
                  <button onClick={() => answerUpdate('sync')} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-brown-dark hover:bg-amber-400">
                    Take library version
                  </button>
                  <button onClick={() => answerUpdate('dismiss')} className="rounded-lg border border-amber-700 px-3 py-1 text-xs hover:bg-amber-900/30">
                    Keep mine
                  </button>
                </>
              )}
            </div>
          </div>
          {showDiff && (
            <div className="mt-3">
              <GuideDiffView
                before={{ title: g.title, summary: g.summary, body: g.body }}
                after={{ title: src.title, summary: src.summary, body: src.body }}
                beforeLabel="Your copy"
                afterLabel="Library"
              />
            </div>
          )}
        </div>
      )}
      {isCopy && !g.followsSource && !behind && src && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-card-border bg-card-bg px-4 py-2.5 text-xs text-text-muted">
          <span>Your customised copy of a library guide. Up to date with library v{src.version}.</span>
          {!readOnly && (
            <button onClick={() => answerUpdate('sync')} className="text-gold hover:underline">
              Revert to library version
            </button>
          )}
        </div>
      )}
      {scope === 'library' && data.copies && data.copies.following + data.copies.forked > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg px-4 py-2.5 text-xs text-text-muted">
          Saving a published change <span className="text-emerald-300">rewrites {data.copies.following} following cop{data.copies.following === 1 ? 'y' : 'ies'}</span>{' '}
          (and their Discord posts) and <span className="text-amber-300">offers the update to {data.copies.forked} customised one{data.copies.forked === 1 ? '' : 's'}</span>. Say what changed below — clans see it.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Editor */}
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className="block">
              <span className="mb-1 block text-xs text-text-muted">Title</span>
              <Input value={form.title} maxLength={GUIDE_LIMITS.title} disabled={readOnly} onChange={(e) => set('title', e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-text-muted">Category</span>
              <Select
                value={form.category}
                disabled={readOnly}
                onChange={(v) => set('category', v)}
                options={GUIDE_CATEGORIES.map((c) => ({ value: c.key, label: `${c.icon} ${c.label}` }))}
                ariaLabel="Category"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 flex justify-between text-xs text-text-muted">
              <span>Summary — one line under the title</span>
              <span>
                {form.summary.length}/{GUIDE_LIMITS.summary}
              </span>
            </span>
            <Input value={form.summary} maxLength={GUIDE_LIMITS.summary} disabled={readOnly} onChange={(e) => set('summary', e.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-1 block text-xs text-text-muted">Cover image (optional — shown at the top, in Discord too)</span>
              <Input
                value={form.coverUrl ?? ''}
                placeholder="https://… or upload"
                disabled={readOnly}
                onChange={(e) => set('coverUrl', e.target.value || null)}
              />
            </label>
            {!readOnly && (
              <div className="flex items-end">
                <input
                  ref={coverRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) {
                      const url = await upload(f);
                      if (url) set('coverUrl', url);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => coverRef.current?.click()}
                  className="h-[38px] rounded border border-card-border px-3 text-sm text-text-muted hover:text-foreground"
                >
                  Upload
                </button>
              </div>
            )}
          </div>

          <div>
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-1 rounded-t border border-b-0 border-card-border bg-black/20 p-1.5">
                {TOOLS.map((t) => (
                  <button
                    key={t.title}
                    type="button"
                    title={t.title}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTool(t)}
                    className={`min-w-[30px] rounded px-1.5 py-1 text-xs text-text-muted hover:bg-white/10 hover:text-foreground ${
                      t.label === 'B' ? 'font-bold' : t.label === 'I' ? 'italic' : t.label === 'U' ? 'underline' : t.label === 'S' ? 'line-through' : ''
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files) void uploadImages(files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="ml-auto rounded bg-gold/15 px-2 py-1 text-xs text-gold hover:bg-gold/25 disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : '🖼 Image'}
                </button>
              </div>
            )}
            <Textarea
              ref={bodyRef}
              value={form.body}
              readOnly={readOnly}
              onChange={(e) => set('body', e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
                if (files.length && !readOnly) {
                  e.preventDefault();
                  void uploadImages(files);
                }
              }}
              onDrop={(e) => {
                const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
                if (files.length && !readOnly) {
                  e.preventDefault();
                  void uploadImages(files);
                }
              }}
              rows={26}
              spellCheck
              placeholder={'## Gear\n- Item one\n- Item two\n\n![Setup](https://…)\n\n---\n\n## The fight\n…'}
              className={`min-h-[420px] font-mono text-[13px] leading-relaxed ${readOnly ? '' : 'rounded-t-none'}`}
            />
            <p className="mt-1 text-[11px] text-text-muted">
              Discord markdown: <code>#</code>/<code>##</code>/<code>###</code> headings, <code>-#</code> subtext, <code>- lists</code>,{' '}
              <code>&gt; quotes</code>, <code>||spoilers||</code>, <code>[links](https://…)</code>. An image on its own line shows under the
              text above it. A line with only <code>---</code> starts a new message. Paste or drop screenshots straight in.
            </p>
          </div>

          {!readOnly && (
            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">
                  {scope === 'library' ? 'What changed? (shown to clans offered the update)' : 'What changed? (for your history)'}
                </span>
                <Input value={note} maxLength={GUIDE_LIMITS.note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated gear for the new ring" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">Link (slug)</span>
                <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} />
              </label>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="min-w-0">
          <div className="mb-2 flex gap-1">
            {(['discord', 'site'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreview(p)}
                className={`rounded-lg px-3 py-1 text-xs ${preview === p ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-foreground'}`}
              >
                {p === 'discord' ? 'Discord' : 'Site'}
              </button>
            ))}
          </div>
          <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
            {preview === 'discord' ? (
              <DiscordPreview guide={previewGuide} origin={origin} />
            ) : (
              <article className="rounded-xl border border-card-border bg-card-bg p-5">
                {form.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.coverUrl} alt="" className="mb-4 max-h-64 w-full rounded-lg object-cover" />
                )}
                <h1 className="text-2xl font-bold text-gold">{form.title}</h1>
                {form.summary && <p className="mt-1 text-sm text-text-muted">{form.summary}</p>}
                <div className="mt-3 text-[15px] text-gray-200">{renderGuide(form.body, { showBreaks: true })}</div>
              </article>
            )}
          </div>
        </div>
      </div>

      {scope === 'clan' && (
        <GuidePostsPanel
          guideId={g.id}
          guideVersion={g.version}
          published={g.status === 'published'}
          dirty={dirty}
          readOnly={readOnly}
          botConnected={data.botConnected === true}
          posts={data.posts ?? []}
          onChange={load}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-card-border bg-card-bg p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <span aria-hidden className="h-4 w-1 rounded-full bg-gold" /> History
          </h2>
          <ul className="space-y-1 text-xs text-text-muted">
            {data.revisions.map((r) => (
              <li key={r.version} className="flex gap-2">
                <span className="w-8 shrink-0 text-gold/80">v{r.version}</span>
                <span className="flex-1">{r.note || <span className="opacity-60">Edited</span>}</span>
                <span className="shrink-0 opacity-70">{r.at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </section>
        {!readOnly && (
          <section className="rounded-xl border border-red-950 bg-card-bg p-4">
            <h2 className="mb-2 text-sm font-bold text-red-300">Delete guide</h2>
            <p className="mb-3 text-xs text-text-muted">
              {scope === 'library'
                ? 'Removes it from the library. Clans that copied it keep their copies.'
                : 'Removes it from your site, and from Discord wherever it was posted.'}
            </p>
            <button onClick={remove} className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40">
              Delete
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
