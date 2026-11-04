'use client';

import { useEffect, useState } from 'react';

import { checkPattern, classifyLine, patternFromSample, type ModeLinePattern } from '@/lib/modeLines';
import Select from '@/components/Select';

interface StoredPattern {
  id: number;
  modeKey: string | null;
  kind: string;
  regex: string;
  title: string;
  note: string | null;
  updatedAt: string;
}

interface Sample {
  id: number;
  modeKey: string;
  template: string;
  sample: string;
  count: number;
  autoPosted: boolean;
  lastSeen: string;
}

interface View {
  builtins: ModeLinePattern[];
  patterns: StoredPattern[];
  samples: Sample[];
  kinds: { id: string; label: string }[];
  modes: { key: string; label: string }[];
}

interface Draft {
  id?: number;
  modeKey: string;
  kind: string;
  regex: string;
  title: string;
  note: string;
  test: string;
}

const field = 'mt-1 w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-xs';

export default function ModeLinesClient() {
  const [view, setView] = useState<View | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch('/api/staff/mode-lines');
    if (res.ok) setView(await res.json());
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
    void load();
  }, []);

  if (!view) return <p className="text-sm text-text-muted">Loading…</p>;

  const kindLabel = (k: string) => (k === 'ignore' ? 'Ignore' : view.kinds.find((x) => x.id === k)?.label ?? k);
  const modeLabel = (k: string | null) => (k === null ? 'Every mode' : view.modes.find((m) => m.key === k)?.label ?? k);

  async function save() {
    if (!draft) return;
    const res = await fetch('/api/staff/mode-lines', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, modeKey: draft.modeKey || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? 'Failed');
      return;
    }
    setMessage(data.cleared ? `Saved. ${data.cleared} queued line${data.cleared === 1 ? '' : 's'} cleared.` : 'Saved.');
    setDraft(null);
    await load();
  }

  async function remove(query: string) {
    await fetch(`/api/staff/mode-lines?${query}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-8">
      {message && <p className="text-sm text-gray-200">{message}</p>}
      {draft && <Editor draft={draft} setDraft={setDraft} view={view} onSave={save} onCancel={() => setDraft(null)} />}

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-100">Waiting for a pattern</h2>
        {view.samples.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing queued.</p>
        ) : (
          <ul className="rounded-xl border border-card-border bg-card-bg">
            {view.samples.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 border-b border-card-border-soft px-4 py-2.5 last:border-b-0">
                <span className="w-12 text-right font-mono text-sm text-gold">{s.count}×</span>
                <span className="w-28 text-xs text-text-muted">{modeLabel(s.modeKey)}</span>
                <span className="min-w-0 flex-1 text-sm text-gray-200">
                  {s.sample}
                  {s.autoPosted && <span className="ml-2 rounded bg-gold/15 px-1.5 py-0.5 text-[11px] text-gold">posted as a milestone</span>}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-card-border px-3 py-1 text-xs hover:border-gold/60"
                  onClick={() =>
                    setDraft({ modeKey: s.modeKey, kind: 'modeMilestone', regex: patternFromSample(s.sample), title: s.sample, note: '', test: s.sample })
                  }
                >
                  Make a pattern
                </button>
                <button type="button" className="text-xs text-text-muted hover:text-gray-200" onClick={() => void remove(`sample=${s.id}`)}>
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-100">Patterns</h2>
          <button
            type="button"
            className="rounded-lg border border-card-border px-3 py-1 text-xs hover:border-gold/60"
            onClick={() => setDraft({ modeKey: '', kind: 'modeRelic', regex: '', title: '', note: '', test: '' })}
          >
            New pattern
          </button>
        </div>
        <p className="mb-3 text-xs text-text-muted">Tried top to bottom; yours run before the built-ins, so a fix always wins.</p>
        <ul className="space-y-2">
          {view.patterns.map((p) => (
            <li key={p.id} className="rounded-xl border border-card-border bg-card-bg px-4 py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gold">{kindLabel(p.kind)}</span>
                <span className="text-xs text-text-muted">{modeLabel(p.modeKey)}</span>
                <span className="text-gray-200">{p.title}</span>
                <span className="flex-1" />
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-gray-200"
                  onClick={() => setDraft({ id: p.id, modeKey: p.modeKey ?? '', kind: p.kind, regex: p.regex, title: p.title, note: p.note ?? '', test: '' })}
                >
                  Edit
                </button>
                <button type="button" className="text-xs text-red-400 hover:text-red-300" onClick={() => void remove(`id=${p.id}`)}>
                  Delete
                </button>
              </div>
              <code className="mt-1 block break-all text-xs text-gray-400">{p.regex}</code>
              {p.note && <p className="mt-1 text-xs text-text-muted">{p.note}</p>}
            </li>
          ))}
          {view.builtins.map((p) => (
            <li key={p.id} className="rounded-xl border border-card-border-soft px-4 py-3 opacity-80">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gold">{kindLabel(p.kind)}</span>
                <span className="text-xs text-text-muted">Built in · every mode</span>
                <span className="text-gray-200">{p.title}</span>
              </div>
              <code className="mt-1 block break-all text-xs text-gray-400">{p.regex}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Editor({
  draft,
  setDraft,
  view,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  view: View;
  onSave: () => Promise<void>;
  onCancel: () => void;
}) {
  const errors = checkPattern({ ...draft, modeKey: draft.modeKey || null });
  const mine: ModeLinePattern = { id: 'draft', modeKey: draft.modeKey || null, kind: draft.kind as ModeLinePattern['kind'], regex: draft.regex, title: draft.title };
  const lines = draft.test.split('\n').map((l) => l.trim()).filter(Boolean);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  return (
    <div className="space-y-3 rounded-xl border border-gold/40 bg-card-bg p-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-gray-300">
          Game mode
          <Select
            value={draft.modeKey}
            onChange={(v) => set({ modeKey: v })}
            options={[{ value: '', label: 'Every mode' }, ...view.modes.map((m) => ({ value: m.key, label: m.label }))]}
            ariaLabel="Game mode"
            className="mt-1"
          />
        </label>
        <label className="text-gray-300">
          Kind
          <Select
            value={draft.kind}
            onChange={(v) => set({ kind: v })}
            options={[...view.kinds.map((k) => ({ value: k.id, label: k.label })), { value: 'ignore', label: 'Ignore — never post, never queue' }]}
            ariaLabel="Kind"
            className="mt-1"
          />
        </label>
      </div>
      <label className="block text-gray-300">
        Pattern <span className="text-xs text-text-muted">— case-insensitive, anywhere in the line; name the parts with (?&lt;name&gt;…)</span>
        <textarea className={`${field} h-16 font-mono`} value={draft.regex} onChange={(e) => set({ regex: e.target.value })} spellCheck={false} />
      </label>
      {draft.kind !== 'ignore' && (
        <label className="block text-gray-300">
          Post title <span className="text-xs text-text-muted">— {'${name}'} puts a named part in</span>
          <input className={field} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
      )}
      <label className="block text-gray-300">
        Note <span className="text-xs text-text-muted">— why, for the next person</span>
        <input className={field} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
      </label>
      <label className="block text-gray-300">
        Test lines <span className="text-xs text-text-muted">— one per line</span>
        <textarea className={`${field} h-20 font-mono`} value={draft.test} onChange={(e) => set({ test: e.target.value })} spellCheck={false} />
      </label>
      {lines.length > 0 && (
        <ul className="space-y-1 text-xs">
          {lines.map((line, i) => {
            const v = classifyLine(line, { key: draft.modeKey || '' }, errors.length ? [] : [mine]);
            const ours = 'patternId' in v && v.patternId === 'draft';
            return (
              <li key={i} className="font-mono">
                <span className="text-gray-300">{line}</span>{' '}
                <span className={ours ? 'text-accent-green-light' : 'text-text-muted'}>
                  →{' '}
                  {v.kind === 'unknown'
                    ? 'no match, queued'
                    : v.kind === 'ignore'
                      ? `ignored${ours ? '' : ` (${v.patternId})`}`
                      : v.kind === 'level'
                        ? `level-up: ${v.skill} ${v.level} (the clan's level rules decide)`
                        : v.kind === 'quest'
                          ? `quest: "${v.name}"`
                          : `${v.kind === 'generic' ? 'milestone (generic)' : v.kind}: "${v.title}"${ours || v.kind === 'generic' ? '' : ` (${v.patternId})`}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {errors.map((e) => (
        <p key={e} className="text-xs text-red-400">
          {e}
        </p>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={errors.length > 0}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark disabled:opacity-50"
        >
          {draft.id ? 'Save pattern' : 'Add pattern'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-card-border px-4 py-2 text-sm text-gray-200 hover:border-gold/60">
          Cancel
        </button>
      </div>
    </div>
  );
}
