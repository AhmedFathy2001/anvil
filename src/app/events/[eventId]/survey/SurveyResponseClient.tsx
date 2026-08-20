'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RATING_MAX, type SurveyAnswerMap, type SurveyQuestionView } from '@/lib/survey';
import { clanFetch } from '@/lib/clanFetch';

interface Props {
  eventId: number;
  eventName: string;
  questions: SurveyQuestionView[];
  initialAnswers: SurveyAnswerMap;
  alreadySubmitted: boolean;
  // Staff preview: render the live form read-only-ish (inputs work so behaviour is visible) but no
  // submit. `previewNotEnded` distinguishes "not open to players yet" from "you're not a participant".
  preview?: boolean;
  previewNotEnded?: boolean;
}

export default function SurveyResponseClient({ eventId, eventName, questions, initialAnswers, alreadySubmitted, preview = false, previewNotEnded = false }: Props) {
  const [answers, setAnswers] = useState<SurveyAnswerMap>(initialAnswers);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function setAnswer(qId: number, value: number | string | string[]) {
    setAnswers((a) => ({ ...a, [qId]: value }));
  }
  function toggleMulti(qId: number, option: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[qId]) ? (a[qId] as string[]) : [];
      return { ...a, [qId]: cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option] };
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/survey/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit');
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto mt-6 border border-accent-green/30 bg-accent-green/5 rounded-xl p-8 text-center">
        <p className="text-lg font-semibold text-accent-green-light mb-1">Thanks for the feedback!</p>
        <p className="text-sm text-text-muted mb-4">Your response to {eventName} has been recorded.</p>
        <Link href={`/events/${eventId}`} className="text-sm text-gold hover:underline">← Back to the event</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {preview && (
        <p className="text-xs text-gold rounded-lg border border-gold/30 bg-gold/10 px-3 py-2">
          Staff preview — this is exactly what participants see{previewNotEnded ? ' once the event ends' : ''}. You can’t submit from here.
        </p>
      )}
      {!preview && alreadySubmitted && (
        <p className="text-xs text-text-muted rounded-lg border border-card-border bg-card-bg px-3 py-2">
          You’ve already responded — feel free to review and update your answers below.
        </p>
      )}

      {questions.map((q, i) => {
        const val = answers[q.id];
        return (
          <div key={q.id} className="border border-card-border rounded-xl p-4 bg-card-bg">
            <p className="text-sm font-medium mb-3">
              {i + 1}. {q.prompt}
              {q.required && <span className="text-red-400 ml-1">*</span>}
            </p>

            {q.type === 'rating' && (
              <div className="flex items-center gap-1.5">
                {Array.from({ length: RATING_MAX }, (_, k) => k + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswer(q.id, n)}
                    className={`w-9 h-9 rounded-lg border text-sm transition-colors ${
                      typeof val === 'number' && val >= n
                        ? 'bg-gold/20 border-gold text-gold'
                        : 'border-card-border text-text-muted hover:border-gold/50'
                    }`}
                    aria-label={`${n} of ${RATING_MAX}`}
                  >
                    ★
                  </button>
                ))}
                {typeof val === 'number' && (
                  <button type="button" onClick={() => setAnswer(q.id, '')} className="text-xs text-text-muted hover:text-foreground ml-2">clear</button>
                )}
              </div>
            )}

            {q.type === 'text' && (
              <textarea
                value={typeof val === 'string' ? val : ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                rows={3}
                placeholder="Your answer"
                className="w-full bg-brown-dark border border-card-border rounded px-3 py-2 text-sm text-foreground placeholder:text-text-muted/60 focus:outline-none focus:border-gold transition-colors resize-y"
              />
            )}

            {q.type === 'single' && (
              <div className="space-y-1.5">
                {q.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name={`q-${q.id}`} checked={val === opt} onChange={() => setAnswer(q.id, opt)} className="h-4 w-4 accent-gold" />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.type === 'multi' && (
              <div className="space-y-1.5">
                {q.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Array.isArray(val) && val.includes(opt)}
                      onChange={() => toggleMulti(q.id, opt)}
                      className="h-4 w-4 accent-gold"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {preview ? (
        <p className="text-xs text-text-muted">Submitting is disabled in preview.</p>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={submitting}
            className="text-sm font-semibold bg-gold/20 text-gold border border-gold/30 px-5 py-2.5 rounded-lg hover:bg-gold/30 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : alreadySubmitted ? 'Update response' : 'Submit feedback'}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      )}
    </div>
  );
}
