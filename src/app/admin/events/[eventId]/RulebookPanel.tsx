'use client';

import { useEffect, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import PostRulesButton from '@/components/PostRulesButton';
import { clanFetch } from '@/lib/clanFetch';
import { renderMarkdown } from '@/lib/markdown';

/**
 * The board's rules: the host's prose for THIS event, and whether they post when it starts.
 *
 * Blank means the clan's house rules (Integrations → Board), shown as the placeholder so the host
 * can see what players will read. Every clan on a co-hosted board reads this same text — on the
 * event page and in its own Discord.
 */
export default function RulebookPanel({ eventId }: { eventId: number }) {
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [original, setOriginal] = useState('');
  const [clanRules, setClanRules] = useState('');
  const [atStart, setAtStart] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    clanFetch(`/api/admin/events/${eventId}/rulebook`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((d) => {
        setText(d.rulebook ?? '');
        setOriginal(d.rulebook ?? '');
        setClanRules(d.clanRules ?? '');
        setAtStart(d.rulesAtStart !== false);
      })
      .catch(() => setMessage({ ok: false, text: 'Could not load the rules.' }))
      .finally(() => setLoaded(true));
  }, [eventId]);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/rulebook`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage({ ok: false, text: d.error ?? 'That did not save.' });
        return false;
      }
      return true;
    } catch {
      setMessage({ ok: false, text: 'That did not save.' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveText() {
    if (await patch({ rulebook: text })) {
      setOriginal(text);
      setMessage({ ok: true, text: text.trim() ? 'Rules saved.' : 'Cleared — this board uses your clan’s house rules.' });
    }
  }

  async function toggleAtStart(on: boolean) {
    setAtStart(on);
    if (!(await patch({ rulesAtStart: on }))) setAtStart(!on);
  }

  if (!loaded) return null;
  const preview = text.trim() || clanRules.trim();

  return (
    <section className="border border-card-border rounded-xl p-5 bg-card-bg">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Rules
      </h2>
      <p className="text-sm text-text-muted mb-4">
        Shown on the event page and posted by the bot, under the board’s mechanics (scoring, reveals, lockout,
        starting shot), which Anvil writes from the board itself. On a co-hosted board every clan reads these.
      </p>

      <label htmlFor="event-rulebook" className="block text-sm font-medium mb-2">
        This board’s rules
      </label>
      <textarea
        id="event-rulebook"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={clanRules || 'Keep a screenshot of every drop.\nRun the plugin if you can.\nDon’t cheat — it’s for fun.'}
        className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold font-mono leading-relaxed"
      />
      <p className="text-xs text-text-muted mt-1">
        Markdown works. Leave it empty to use your clan’s house rules
        {clanRules ? ' (shown above as the placeholder)' : ' (Integrations → Board — none set yet)'}.
      </p>

      {preview && (
        <div className="mt-3 rounded-lg border border-card-border bg-background px-4 py-3">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            {text.trim() ? 'How it will read' : 'Players will read your house rules'}
          </div>
          <div className="text-sm text-foreground">{renderMarkdown(preview)}</div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          type="button"
          onClick={saveText}
          disabled={busy || text === original}
          className="px-3 py-1.5 rounded-lg text-sm border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 disabled:opacity-50 transition-colors"
        >
          Save rules
        </button>
        {message && <span className={`text-sm ${message.ok ? 'text-green-400' : 'text-red-400'}`}>{message.text}</span>}
      </div>

      <div className="border-t border-card-border mt-5 pt-4 space-y-4">
        <Checkbox
          checked={atStart}
          onChange={toggleAtStart}
          disabled={busy}
          label="Post the rules to Discord when the event starts"
          description="Right under the start announcement, in every clan on the board that has a channel set up."
        />
        <PostRulesButton eventId={eventId} label="Post rules to Discord now" />
      </div>
    </section>
  );
}
