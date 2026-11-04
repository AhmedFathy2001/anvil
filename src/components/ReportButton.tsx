'use client';

import { useCallback, useState } from 'react';

import { useModalA11y } from '@/hooks/useModalA11y';
import { clanFetch } from '@/lib/clanFetch';
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABEL, REPORT_NOTE_MAX, type ReportCategory, type ReportTarget } from '@/lib/platformReportRules';
import Radio from '@/components/Radio';

/** What the dialog calls the thing, in "Report this …". */
const NOUN: Record<ReportTarget, string> = {
  space: 'page',
  creator_panel: 'panel',
  clan: 'clan',
  event: 'event',
  character: 'profile',
  person: 'profile',
  highlight: 'clip',
};

function Flag({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden className="shrink-0">
      <path fill="currentColor" d="M3 1.5a.75.75 0 0 1 .75.75V3h8.6a.6.6 0 0 1 .48.96L11.2 6.25l1.63 2.29a.6.6 0 0 1-.48.96H3.75v5.75a.75.75 0 0 1-1.5 0V2.25A.75.75 0 0 1 3 1.5Z" />
    </svg>
  );
}

/**
 * A small "Report" (flag) that sends a report to Anvil staff (lib/platformReports) — never to the
 * people who run the thing being reported, who never learn who sent it. Signed-in viewers only: the
 * caller does not render it for anyone else. Opens an in-page dialog (a reason, an optional note,
 * Send), then says thanks.
 */
export default function ReportButton({
  type,
  id,
  label = 'Report',
  iconOnly = false,
  className = '',
}: {
  type: ReportTarget;
  id: number;
  label?: string;
  /** Just the flag (a tight spot, like a clip card); the label becomes its accessible name. */
  iconOnly?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={sent ? 'Reported — thanks' : `Report this ${NOUN[type]} to Anvil`}
        aria-label={iconOnly ? (sent ? 'Reported' : `Report this ${NOUN[type]}`) : undefined}
        className={`inline-flex items-center gap-1 text-[11.5px] text-text-dim transition-colors hover:text-gold ${className}`}
      >
        <Flag />
        {!iconOnly && <span>{sent ? 'Reported' : label}</span>}
      </button>
      {open && <ReportDialog type={type} id={id} sent={sent} onSent={() => setSent(true)} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportDialog({ type, id, sent, onSent, onClose }: { type: ReportTarget; id: number; sent: boolean; onSent: () => void; onClose: () => void }) {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanked, setThanked] = useState(sent);
  const close = useCallback(() => onClose(), [onClose]);
  const ref = useModalA11y<HTMLDivElement>({ onClose: close });

  async function send() {
    if (!category || sending) return;
    setSending(true);
    setError(null);
    // clan-prefix: platform -- reports are addressed by the thing's own id, not by this page's host.
    const res = await clanFetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, category, note }),
    }).catch(() => null);
    setSending(false);
    if (res?.ok) {
      setThanked(true);
      onSent();
      return;
    }
    setError((await res?.json().catch(() => null))?.error ?? 'That did not send. Try again in a moment.');
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={close} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="anvil-report-title"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-card-border bg-card-bg p-5 text-left shadow-2xl"
      >
        {thanked ? (
          <>
            <h2 id="anvil-report-title" className="text-base font-bold text-foreground">
              Thanks — it&rsquo;s with Anvil staff
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              We&rsquo;ll take a look. Whoever runs this {NOUN[type]} is never told who reported it.
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={close} className="rounded-lg border border-card-border px-3 py-1.5 text-sm hover:border-gold/50 hover:text-gold">
                Close
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <h2 id="anvil-report-title" className="text-base font-bold text-foreground">
              Report this {NOUN[type]}
            </h2>
            <p className="mt-1 text-[13px] text-text-muted">It goes to Anvil staff, not to whoever runs it.</p>
            <fieldset className="mt-4 space-y-1">
              <legend className="mb-1.5 text-xs text-text-muted">What&rsquo;s wrong?</legend>
              {REPORT_CATEGORIES.map((c) => (
                <label key={c} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-brown-dark/50">
                  <Radio
                    name="report-reason"
                    value={c}
                    checked={category === c}
                    onChange={() => setCategory(c)}
                    className="mt-0.5"
                  />
                  <span>{REPORT_CATEGORY_LABEL[c]}</span>
                </label>
              ))}
            </fieldset>
            <label htmlFor="anvil-report-note" className="mt-3 block text-xs text-text-muted">
              Anything staff should know? (optional)
            </label>
            <textarea
              id="anvil-report-note"
              value={note}
              maxLength={REPORT_NOTE_MAX}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm outline-none focus:border-gold/50"
            />
            <p className="text-right text-[11px] text-text-dim">
              {note.length}/{REPORT_NOTE_MAX}
            </p>
            {error && <p className="mt-1 text-[13px] text-accent-red">{error}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={close} className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:text-foreground">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!category || sending}
                className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
