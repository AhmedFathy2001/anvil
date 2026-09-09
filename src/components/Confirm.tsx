'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';

/**
 * Asking before you do it, and saying what happened after.
 *
 * THE ADMIN AREA HAD SIXTY-FOUR BROWSER DIALOGS. Forty-four `confirm()`, twelve `alert()`, eight
 * `prompt()`, spread over nineteen files, each one worded by whoever wrote that surface. They are
 * the one place the product visibly stopped being designed: a grey OS box in a gold-and-brown app,
 * with a title bar that says the hostname, no room to explain what is about to happen, and — for
 * `prompt()` — a bare text field with no validation collecting a string that goes into a clan's
 * permanent history.
 *
 * They are also genuinely dangerous in two ways worth naming:
 *
 *   - A native dialog BLOCKS the event loop. Anything mid-flight (a poll, a save, an optimistic
 *     update) is frozen behind it for as long as it stands open, which on a slow connection is
 *     however long the person takes to read it.
 *   - They cannot say what is about to be destroyed. `confirm('Delete this event?')` is the same
 *     six words whether the board is empty or holds four hundred submissions, so the answer people
 *     learn is "yes", which is what makes the accident possible.
 *
 * So: one imperative API, three verbs, promise-shaped so a call site reads exactly the way the
 * native one did and converts in a line.
 *
 *     const { confirm, ask, notify } = useDialog();
 *
 *     if (!(await confirm({ title: 'Delete Bingo #7?', body: '…', confirmLabel: 'Delete', tone: 'danger' }))) return;
 *     const reason = await ask({ title: 'Why?', label: 'Reason', required: true });
 *     notify('Saved.');
 *
 * Escape, the focus trap, initial focus, focus restore and the scroll lock all come from
 * useModalA11y, which the tile modal already uses — this adds no second opinion about any of it.
 */

type Tone = 'default' | 'danger' | 'gold';

interface BaseRequest {
  title: string;
  /** The consequence, in a sentence. This is the half a native dialog had no room for. */
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

type ConfirmRequest = BaseRequest;

interface AskRequest extends BaseRequest {
  /** Label above the field. */
  label?: string;
  initial?: string;
  placeholder?: string;
  /** Refuse an empty answer — the reason-for-the-record case. */
  required?: boolean;
  /** A long answer (a reason, a note) gets a textarea instead of one line. */
  multiline?: boolean;
}

interface DialogApi {
  /** Resolves true if they went ahead. Replaces window.confirm. */
  confirm: (req: ConfirmRequest) => Promise<boolean>;
  /** Resolves the typed string, or null if they backed out. Replaces window.prompt. */
  ask: (req: AskRequest) => Promise<string | null>;
  /** A transient line in the corner. Replaces window.alert, which nothing should block for. */
  notify: (message: string, tone?: 'ok' | 'error') => void;
}

type Pending =
  | { kind: 'confirm'; req: ConfirmRequest; resolve: (v: boolean) => void }
  | { kind: 'ask'; req: AskRequest; resolve: (v: string | null) => void };

interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error';
}

const DialogContext = createContext<DialogApi | null>(null);

/** How long a notice stands before it goes. Long enough to read a sentence, twice. */
const TOAST_MS = 6000;

const TONE_BUTTON: Record<Tone, string> = {
  default: 'border border-card-border hover:border-gold/50 hover:text-gold',
  gold: 'bg-gold text-brown-dark hover:bg-gold-light font-semibold',
  danger: 'bg-accent-red/90 text-white hover:bg-accent-red font-semibold',
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastId = useRef(1);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (req) =>
        new Promise<boolean>((resolve) => setPending({ kind: 'confirm', req, resolve })),
      ask: (req) => new Promise<string | null>((resolve) => setPending({ kind: 'ask', req, resolve })),
      notify: (message, tone = 'ok') => {
        const id = nextToastId.current++;
        setToasts((t) => [...t, { id, message, tone }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
      },
    }),
    [],
  );

  // Settling ALWAYS resolves the promise. An unresolved one leaves the caller's `await` hanging
  // forever, which is a stuck spinner and a disabled button with no way back.
  const settle = useCallback(
    (value: boolean | string | null) => {
      setPending((cur) => {
        if (!cur) return null;
        if (cur.kind === 'confirm') cur.resolve(value === true);
        else cur.resolve(typeof value === 'string' ? value : null);
        return null;
      });
    },
    [],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      {pending && <DialogHost pending={pending} onSettle={settle} />}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[min(24rem,calc(100vw-2rem))]">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
                t.tone === 'error'
                  ? 'border-accent-red/40 bg-accent-red/15 text-red-200'
                  : 'border-card-border bg-card-bg/95 text-foreground'
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </DialogContext.Provider>
  );
}

/**
 * Keyed on the request so a second dialog opening over a first gets fresh state rather than the
 * previous one's typed text.
 */
function DialogHost({ pending, onSettle }: { pending: Pending; onSettle: (v: boolean | string | null) => void }) {
  return <DialogBox key={pending.req.title} pending={pending} onSettle={onSettle} />;
}

function DialogBox({ pending, onSettle }: { pending: Pending; onSettle: (v: boolean | string | null) => void }) {
  const isAsk = pending.kind === 'ask';
  const askReq = isAsk ? (pending.req as AskRequest) : null;
  const [value, setValue] = useState(askReq?.initial ?? '');

  // Escape and the backdrop both mean "no" — the same answer the native dialogs gave.
  const cancel = useCallback(() => onSettle(pending.kind === 'confirm' ? false : null), [onSettle, pending.kind]);
  const ref = useModalA11y<HTMLDivElement>({ onClose: cancel });

  const blocked = !!(askReq?.required && !value.trim());
  const tone: Tone = pending.req.tone ?? (pending.kind === 'confirm' ? 'danger' : 'gold');

  function accept() {
    if (blocked) return;
    onSettle(isAsk ? value : true);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={cancel} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="anvil-dialog-title"
        className="relative w-full max-w-md rounded-xl border border-card-border bg-card-bg p-5 shadow-2xl"
      >
        <h2 id="anvil-dialog-title" className="text-base font-bold text-foreground">
          {pending.req.title}
        </h2>
        {pending.req.body && (
          <p className="mt-2 text-sm text-text-muted leading-relaxed">{pending.req.body}</p>
        )}

        {askReq && (
          <div className="mt-4">
            {askReq.label && (
              <label htmlFor="anvil-dialog-field" className="block text-xs text-text-muted mb-1.5">
                {askReq.label}
              </label>
            )}
            {askReq.multiline ? (
              <textarea
                id="anvil-dialog-field"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={askReq.placeholder}
                rows={3}
                className="w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm outline-none focus:border-gold/50"
              />
            ) : (
              <input
                id="anvil-dialog-field"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={askReq.placeholder}
                // Enter submits a one-line answer, the way the native prompt did.
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    accept();
                  }
                }}
                className="w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm outline-none focus:border-gold/50"
              />
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            className="px-3 py-1.5 text-sm rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
          >
            {pending.req.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={blocked}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${TONE_BUTTON[tone]}`}
          >
            {pending.req.confirmLabel ?? (isAsk ? 'Save' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The three verbs.
 *
 * Falls back to the native dialogs when no provider is mounted, so a component lifted into a tree
 * without one degrades to what it did before rather than silently doing nothing — the failure that
 * would otherwise be a Delete button that never deletes.
 */
export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  return (
    ctx ?? {
      confirm: async (req) => window.confirm([req.title, req.body].filter(Boolean).join('\n\n')),
      ask: async (req) => window.prompt([req.title, req.body].filter(Boolean).join('\n\n'), req.initial ?? ''),
      notify: (message) => window.alert(message),
    }
  );
}
