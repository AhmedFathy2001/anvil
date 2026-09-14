'use client';

import Checkbox from '@/components/Checkbox';
import Textarea from '@/components/Textarea';
import { RATING_MAX, type SurveyQuestionView } from '@/lib/survey';

/**
 * The board's own questions, on the sign-up form.
 *
 * SAME MODEL AS THE POST-EVENT SURVEY, asked at the other end of the event — a question on a board
 * has a prompt, a type, an order and whether it is required, and that is as true of "how many hours
 * a week can you play?" as of "how was the board?". So there is one question model, one builder and
 * one set of inputs rather than a second of each that would drift.
 *
 * Answers are keyed by question id, which is what lets a host reword a prompt without orphaning what
 * people already said.
 */

export type AnswerValue = number | string | string[];

export default function SignupQuestions({
  questions,
  answers,
  onChange,
  disabled = false,
}: {
  questions: SurveyQuestionView[];
  answers: Record<string, AnswerValue>;
  onChange: (questionId: number, value: AnswerValue | undefined) => void;
  disabled?: boolean;
}) {
  if (questions.length === 0) return null;

  return (
    <fieldset className="border border-card-border rounded-xl p-4 bg-card-bg space-y-4">
      <legend className="px-2 text-sm font-bold text-gold">A few questions from the host</legend>

      {questions.map((q) => {
        const value = answers[String(q.id)];
        return (
          <div key={q.id} className="space-y-1.5">
            <label className="block text-sm font-medium">
              {q.prompt}
              {q.required && <span className="ml-1 text-gold" aria-hidden>*</span>}
            </label>

            {q.type === 'text' && (
              <Textarea
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(q.id, e.target.value || undefined)}
                disabled={disabled}
                maxLength={1000}
                rows={3}
                className="w-full px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
              />
            )}

            {q.type === 'rating' && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={disabled}
                    aria-pressed={value === n}
                    // Pressing the chosen number again clears it — a rating nobody meant to give is
                    // otherwise impossible to take back on a form with no "none" option.
                    onClick={() => onChange(q.id, value === n ? undefined : n)}
                    className={`h-8 w-8 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
                      value === n
                        ? 'border-gold bg-gold/15 text-gold'
                        : 'border-card-border text-text-muted hover:border-gold/40'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'single' && (
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={disabled}
                    aria-pressed={value === opt}
                    onClick={() => onChange(q.id, value === opt ? undefined : opt)}
                    className={`rounded-lg border px-2.5 py-1 text-[13px] transition-colors disabled:opacity-50 ${
                      value === opt
                        ? 'border-gold bg-gold/15 text-gold'
                        : 'border-card-border text-text-muted hover:border-gold/40'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'multi' && (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {q.options.map((opt) => {
                  const chosen = Array.isArray(value) && value.includes(opt);
                  return (
                    <Checkbox
                      key={opt}
                      checked={chosen}
                      disabled={disabled}
                      label={opt}
                      labelClassName="text-[13px]"
                      onChange={(on) => {
                        const current = Array.isArray(value) ? value : [];
                        const next = on ? [...current, opt] : current.filter((v) => v !== opt);
                        onChange(q.id, next.length > 0 ? next : undefined);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
