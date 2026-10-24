'use client';

import { useEffect, useState } from 'react';

import { CHAT_PATTERN_CATALOG, checkOverride, testLine, type ChatPatternEntry } from '@/lib/chatPatternRules';

interface Override {
  key: string;
  regex: string;
  hint: string | null;
  note: string | null;
  updatedAt: string;
}

export default function ChatPatternsClient() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/staff/chat-patterns');
    if (res.ok) setOverrides((await res.json()).overrides);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
    void load();
  }, []);

  const byKey = new Map(overrides.map((o) => [o.key, o]));
  return (
    <ul className="space-y-2">
      {CHAT_PATTERN_CATALOG.patterns.map((entry) => {
        const o = byKey.get(entry.key);
        return (
          <li key={entry.key} className="rounded-xl border border-card-border bg-card-bg">
            <button type="button" className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(open === entry.key ? null : entry.key)}>
              <span className="font-mono text-sm text-gold">{entry.key}</span>
              {o && <span className="rounded bg-gold/15 px-2 py-0.5 text-xs text-gold">overridden</span>}
              <span className="truncate text-sm text-text-muted">{entry.description}</span>
            </button>
            {open === entry.key && <PatternEditor entry={entry} override={o} onSaved={load} />}
          </li>
        );
      })}
    </ul>
  );
}

function PatternEditor({ entry, override, onSaved }: { entry: ChatPatternEntry; override?: Override; onSaved: () => Promise<void> }) {
  const [regex, setRegex] = useState(override?.regex ?? entry.regex);
  const [hint, setHint] = useState(override?.hint ?? '');
  const [note, setNote] = useState(override?.note ?? '');
  const [lines, setLines] = useState(entry.samples.map((s) => s.line).join('\n'));
  const [message, setMessage] = useState('');
  const check = checkOverride(entry.key, regex);

  async function save() {
    const res = await fetch('/api/staff/chat-patterns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: entry.key, regex, hint, note }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Saved — plugins pick it up on their next poll.' : data.error ?? 'Failed');
    if (res.ok) await onSaved();
  }

  async function revert() {
    await fetch(`/api/staff/chat-patterns?key=${encodeURIComponent(entry.key)}`, { method: 'DELETE' });
    setRegex(entry.regex);
    setHint('');
    setNote('');
    setMessage('Back to the built-in pattern.');
    await onSaved();
  }

  const field = 'mt-1 w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 font-mono text-xs';
  return (
    <div className="space-y-3 border-t border-card-border px-4 py-4 text-sm">
      <div className="text-xs text-text-muted">
        Channels: {entry.types.join(', ')} · runs on the {entry.input} line · {entry.match === 'full' ? 'whole line' : 'anywhere in the line'}
        {entry.flags?.length ? ` · ${entry.flags.join(', ')}` : ''} · needs groups: {entry.groups.map((g) => `(?<${g}>…)`).join(' ') || 'none'}
      </div>
      <div>
        <div className="text-xs text-text-muted">Built-in</div>
        <code className="block break-all rounded bg-brown-dark px-3 py-2 text-xs text-gray-400">{entry.regex}</code>
      </div>
      <label className="block text-gray-300">
        Override
        <textarea className={`${field} h-20`} value={regex} onChange={(e) => setRegex(e.target.value)} spellCheck={false} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-gray-300">
          Hint <span className="text-xs text-text-muted">— optional text every matching line contains (cheap pre-check)</span>
          <input className={field} value={hint} onChange={(e) => setHint(e.target.value)} />
        </label>
        <label className="text-gray-300">
          Note <span className="text-xs text-text-muted">— why, for the next person</span>
          <input className={`${field} font-sans`} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      {check.errors.map((e) => <p key={e} className="text-xs text-red-400">{e}</p>)}
      {check.warnings.map((w) => <p key={w} className="text-xs text-gold">{w}</p>)}

      <label className="block text-gray-300">
        Test lines <span className="text-xs text-text-muted">— one per line; paste the new in-game wording</span>
        <textarea className={`${field} h-24`} value={lines} onChange={(e) => setLines(e.target.value)} spellCheck={false} />
      </label>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="py-1 pr-2 font-normal">Line</th>
            <th className="py-1 pr-2 font-normal">Built-in</th>
            <th className="py-1 font-normal">Override</th>
          </tr>
        </thead>
        <tbody>
          {lines.split('\n').filter((l) => l.trim()).map((line, i) => (
            <tr key={i} className="border-t border-card-border align-top">
              <td className="py-1 pr-2 font-mono text-gray-300">{line}</td>
              <td className="py-1 pr-2"><MatchCell result={testLine(entry, entry.regex, line)} /></td>
              <td className="py-1"><MatchCell result={testLine(entry, regex, line)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-text-muted">The tester uses the browser&apos;s regex engine, which is close to Java&apos;s but not identical.</p>

      {message && <p className="text-gray-200">{message}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={check.errors.length > 0 || regex === entry.regex}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark disabled:opacity-50"
        >
          Save override
        </button>
        {override && (
          <button type="button" onClick={revert} className="rounded-lg border border-card-border px-4 py-2 text-sm text-gray-200 hover:border-gold/60">
            Revert to built-in
          </button>
        )}
      </div>
    </div>
  );
}

function MatchCell({ result }: { result: Record<string, string> | null | 'uncompilable' }) {
  if (result === 'uncompilable') return <span className="text-gold">can&apos;t compile in JS</span>;
  if (!result) return <span className="text-text-muted">no match</span>;
  const groups = Object.entries(result);
  return (
    <span className="text-accent-green-light">
      ✓{groups.length ? ' ' : ''}
      {groups.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}
    </span>
  );
}
