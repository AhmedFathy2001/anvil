'use client';

import { useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

export default function FeedbackForm() {
  const [kind, setKind] = useState<'bug' | 'feedback'>('bug');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError('Please add a subject and some details.');
      return;
    }
    setBusy(true);
    setError('');
    const res = await clanFetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        subject,
        body,
        pageUrl: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      }),
    });
    setBusy(false);
    if (res.ok) setDone(true);
    else setError((await res.json().catch(() => ({}))).error || 'Could not send — try again.');
  }

  if (done) {
    return (
      <div className="border border-accent-green/30 bg-accent-green/10 rounded-xl p-6 text-center">
        <p className="font-semibold text-accent-green-light mb-1">Thanks — sent to the admins.</p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setSubject('');
            setBody('');
          }}
          className="text-sm text-gold hover:underline underline-offset-2 mt-1"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2">
        {(['bug', 'feedback'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              kind === k ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/40'
            }`}
          >
            {k === 'bug' ? '🐛 Bug report' : '💡 Feedback'}
          </button>
        ))}
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Subject *</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={160}
          placeholder={kind === 'bug' ? 'e.g. Board doesn’t load on my phone' : 'e.g. Add a dark mode toggle'}
          className="w-full text-sm px-3 py-2 bg-brown-dark border border-card-border rounded-lg focus:outline-none focus:border-gold/50"
        />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Details *</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={5000}
          placeholder={kind === 'bug' ? 'What happened, what you expected, and steps to reproduce.' : 'Tell us what you’d like.'}
          className="w-full text-sm px-3 py-2 bg-brown-dark border border-card-border rounded-lg resize-y focus:outline-none focus:border-gold/50"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 text-sm font-semibold rounded-lg bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
