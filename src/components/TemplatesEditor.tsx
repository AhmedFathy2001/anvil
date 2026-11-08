'use client';

import { useState } from 'react';

import Input from '@/components/Input';
import {
  previewTemplate,
  resolveTemplate,
  TEMPLATE_KINDS,
  TEMPLATE_MAX,
  TEMPLATE_SPECS,
  type TemplateKind,
  type Templates,
} from '@/lib/notifyTemplates';

/**
 * A message template per kind (lib/notifyTemplates): the sentence its Discord post leads with. Click
 * a placeholder to add it; the preview fills in sample values. A player sees their clan's template
 * until they write their own; a clan sets the default and never sees the private kinds.
 */
export default function TemplatesEditor({
  mode,
  value,
  inherited = {},
  hasClan,
  busy,
  onSave,
}: {
  mode: 'personal' | 'clan';
  value: Templates;
  /** A player's clan templates. */
  inherited?: Templates;
  hasClan: boolean;
  busy: boolean;
  onSave: (next: Templates) => void;
}) {
  const kinds = TEMPLATE_KINDS.filter((k) => mode === 'personal' || !('personalOnly' in TEMPLATE_SPECS[k]));
  const save = (k: TemplateKind, t: string | null) => {
    const next = { ...value };
    if (t) next[k] = t;
    else delete next[k];
    onSave(next);
  };
  return (
    <div className="grid gap-3">
      <p className="max-w-[70ch] text-[12.5px] text-text-muted">
        The first line of each Discord post. Leave one alone and it reads as it always has. Words in braces are filled in for you; anything else in braces stays as typed. Mentions and links are never posted.
      </p>
      {kinds.map((k) => (
        <Row
          key={k}
          kind={k}
          own={value[k] ?? null}
          fallback={mode === 'personal' ? resolveTemplate(k, {}, inherited).template : TEMPLATE_SPECS[k].def}
          fromClan={mode === 'personal' && resolveTemplate(k, {}, inherited).source === 'clan'}
          clanMode={mode === 'clan'}
          hasClan={hasClan}
          busy={busy}
          onSave={(t) => save(k, t)}
        />
      ))}
    </div>
  );
}

function Row({
  kind,
  own,
  fallback,
  fromClan,
  clanMode,
  hasClan,
  busy,
  onSave,
}: {
  kind: TemplateKind;
  own: string | null;
  fallback: string;
  fromClan: boolean;
  clanMode: boolean;
  hasClan: boolean;
  busy: boolean;
  onSave: (t: string | null) => void;
}) {
  const spec = TEMPLATE_SPECS[kind];
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? own ?? fallback;
  function commit() {
    if (draft === null) return;
    const t = draft.trim();
    setDraft(null);
    if (t === (own ?? fallback)) return;
    onSave(t && t !== fallback ? t : null);
  }
  const status = own ? 'Custom' : clanMode ? "Using Anvil's default" : fromClan ? 'Using clan default' : "Using Anvil's default";
  const reset = clanMode || !hasClan ? 'Reset to default' : 'Reset to clan default';
  return (
    <div className="grid gap-1.5 rounded-lg border border-card-border bg-card-bg/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{spec.label}</span>
        <span className="flex items-center gap-2 text-[11.5px] text-text-muted">
          {status}
          {own && (
            <button type="button" disabled={busy} onClick={() => onSave(null)} className="text-gold hover:underline disabled:opacity-50">
              {reset}
            </button>
          )}
        </span>
      </div>
      <Input
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        maxLength={TEMPLATE_MAX}
        disabled={busy}
        placeholder={kind === 'pvp' ? "The plugin's own kill line" : undefined}
        aria-label={`${spec.label} message`}
        className="w-full px-2 py-1 text-xs"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {Object.keys(spec.vars).map((v) => (
          <button
            key={v}
            type="button"
            disabled={busy}
            // Keep focus in the field's flow: the click adds the placeholder, the next blur saves it.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setDraft(`${shown}${shown && !shown.endsWith(' ') ? ' ' : ''}{${v}}`)}
            className="rounded border border-card-border px-1.5 py-0.5 font-mono text-[10.5px] text-text-muted hover:border-gold/50 hover:text-gold"
          >
            {`{${v}}`}
          </button>
        ))}
        {draft !== null && (
          <button type="button" disabled={busy} onClick={commit} className="ml-auto rounded-md border border-gold/40 px-2 py-0.5 text-[11px] text-gold hover:bg-gold/10">
            Save
          </button>
        )}
      </div>
      {shown && <p className="text-[11.5px] text-text-muted">Preview: {previewTemplate(kind, shown)}</p>}
    </div>
  );
}
