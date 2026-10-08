'use client';

import { useEffect, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import PostRulesButton from '@/components/PostRulesButton';
import { clanFetch } from '@/lib/clanFetch';
import { renderMarkdown } from '@/lib/markdown';

/**
 * The event's two pieces of prose:
 *   1. the main Discord announcement, prefilled from the live mechanics but editable per event;
 *   2. the host's event/house-rule addendum, also shown on the event page.
 *
 * Posting before the event captures the webhook message ids. Every later post edits those same
 * host/co-host messages, including the automatic start-time refresh.
 */
export default function RulebookPanel({ eventId }: { eventId: number }) {
  const [loaded, setLoaded] = useState(false);
  const [rulesMessage, setRulesMessage] = useState('');
  const [originalRulesMessage, setOriginalRulesMessage] = useState('');
  const [generatedRulesMessage, setGeneratedRulesMessage] = useState('');
  const [customRulesMessage, setCustomRulesMessage] = useState(false);
  const [postedToDiscord, setPostedToDiscord] = useState(false);
  const [rulebook, setRulebook] = useState('');
  const [originalRulebook, setOriginalRulebook] = useState('');
  const [clanRules, setClanRules] = useState('');
  const [atStart, setAtStart] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    clanFetch(`/api/admin/events/${eventId}/rulebook`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((d) => {
        const storedMessage = typeof d.rulesMessage === 'string' ? d.rulesMessage : '';
        const generatedMessage = typeof d.generatedRulesMessage === 'string' ? d.generatedRulesMessage : '';
        const effectiveMessage = storedMessage.trim() ? storedMessage : generatedMessage;
        setRulesMessage(effectiveMessage);
        setOriginalRulesMessage(effectiveMessage);
        setGeneratedRulesMessage(generatedMessage);
        setCustomRulesMessage(!!storedMessage.trim());
        setPostedToDiscord(d.postedToDiscord === true);
        setRulebook(d.rulebook ?? '');
        setOriginalRulebook(d.rulebook ?? '');
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

  async function saveRulesMessage(showSuccess = true): Promise<boolean> {
    if (rulesMessage === originalRulesMessage) return true;
    if (!rulesMessage.trim()) {
      setMessage({ ok: false, text: 'The Discord announcement cannot be blank. Reset it from the event settings instead.' });
      return false;
    }
    if (!(await patch({ rulesMessage }))) return false;
    setOriginalRulesMessage(rulesMessage);
    setCustomRulesMessage(true);
    if (showSuccess) {
      setMessage({
        ok: true,
        text: postedToDiscord
          ? 'Announcement saved. Use “Update Discord rules post” to publish the change.'
          : 'Announcement saved.',
      });
    }
    return true;
  }

  async function useGeneratedMessage() {
    if (!(await patch({ rulesMessage: null }))) return;
    setRulesMessage(generatedRulesMessage);
    setOriginalRulesMessage(generatedRulesMessage);
    setCustomRulesMessage(false);
    setMessage({
      ok: true,
      text: postedToDiscord
        ? 'Using the live event settings again. Update the Discord post to publish it.'
        : 'Using the live event settings again.',
    });
  }

  async function saveRulebook() {
    if (await patch({ rulebook })) {
      setOriginalRulebook(rulebook);
      setMessage({ ok: true, text: rulebook.trim() ? 'House-rules addendum saved.' : 'Cleared — this board uses your clan’s house rules.' });
    }
  }

  async function toggleAtStart(on: boolean) {
    setAtStart(on);
    if (!(await patch({ rulesAtStart: on }))) setAtStart(!on);
  }

  if (!loaded) return null;
  const rulebookPreview = rulebook.trim() || clanRules.trim();

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Rules & Discord announcement
      </h2>
      <p className="mb-5 text-sm text-text-muted">
        The main announcement is prefilled from this bingo’s scoring, reveals, missions, proof, teams and fees.
        Edit it for this event before it is sent; the optional house-rules addendum stays separate underneath.
      </p>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="event-rules-message" className="text-sm font-medium">
          Discord rules announcement
        </label>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${customRulesMessage ? 'border-gold/30 text-gold' : 'border-card-border text-text-muted'}`}>
          {customRulesMessage ? 'Custom for this bingo' : 'Generated from current settings'}
        </span>
      </div>
      <textarea
        id="event-rules-message"
        value={rulesMessage}
        onChange={(event) => setRulesMessage(event.target.value)}
        rows={15}
        maxLength={3500}
        className="w-full rounded-lg border border-card-border bg-bg px-3 py-2 font-mono text-sm leading-relaxed focus:border-gold focus:outline-none"
      />
      <div className="mt-1 flex flex-wrap items-start justify-between gap-2 text-xs text-text-muted">
        <span>Discord Markdown works. The title, event link, format, teams and footer stay automatic.</span>
        <span>{rulesMessage.length.toLocaleString()} / 3,500</span>
      </div>
      <div className="mt-3 rounded-lg border border-card-border bg-background px-4 py-3">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Main Discord message preview
        </div>
        <div className="text-sm text-foreground">{renderMarkdown(rulesMessage)}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void saveRulesMessage()}
          disabled={busy || rulesMessage === originalRulesMessage || !rulesMessage.trim()}
          className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-1.5 text-sm text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
        >
          Save announcement
        </button>
        {(customRulesMessage || rulesMessage !== generatedRulesMessage) && (
          <button
            type="button"
            onClick={useGeneratedMessage}
            disabled={busy}
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:border-gold/40 disabled:opacity-50"
          >
            Reset from current event settings
          </button>
        )}
      </div>

      <div className="mt-6 border-t border-card-border pt-5">
        <label htmlFor="event-rulebook" className="mb-2 block text-sm font-medium">
          House-rules addendum <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <textarea
          id="event-rulebook"
          value={rulebook}
          onChange={(event) => setRulebook(event.target.value)}
          rows={8}
          placeholder={clanRules || 'Keep a screenshot of every drop.\nRun the plugin if you can.\nDon’t cheat — it’s for fun.'}
          className="w-full rounded-lg border border-card-border bg-bg px-3 py-2 font-mono text-sm leading-relaxed focus:border-gold focus:outline-none"
        />
        <p className="mt-1 text-xs text-text-muted">
          Shown as a second Discord card and on the event page. Leave it empty to use your clan’s house rules
          {clanRules ? ' (shown above as the placeholder)' : ' (Integrations → Board — none set yet)'}.
        </p>

        {rulebookPreview && (
          <div className="mt-3 rounded-lg border border-card-border bg-background px-4 py-3">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
              {rulebook.trim() ? 'House-rules preview' : 'Players will read your clan house rules'}
            </div>
            <div className="text-sm text-foreground">{renderMarkdown(rulebookPreview)}</div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveRulebook}
            disabled={busy || rulebook === originalRulebook}
            className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-1.5 text-sm text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
          >
            Save addendum
          </button>
          {message && <span className={`text-sm ${message.ok ? 'text-green-400' : 'text-red-400'}`}>{message.text}</span>}
        </div>
      </div>

      <div className="mt-5 space-y-4 border-t border-card-border pt-4">
        <Checkbox
          checked={atStart}
          onChange={toggleAtStart}
          disabled={busy}
          label="Post or refresh the Discord rules when the event starts"
          description="If you already posted them before the bingo, Anvil updates those same host and co-host messages. Otherwise it creates them under the start announcement."
        />
        <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-xs text-text-muted">
          <strong className="text-gold">Before the bingo:</strong>{' '}
          use the button below whenever you are ready. Later clicks edit the same webhook posts instead of adding duplicates.
        </div>
        <PostRulesButton
          eventId={eventId}
          label={postedToDiscord ? 'Update Discord rules post now' : 'Post rules to Discord now (before bingo)'}
          beforePost={() => saveRulesMessage(false)}
          onPosted={() => setPostedToDiscord(true)}
        />
      </div>
    </section>
  );
}
