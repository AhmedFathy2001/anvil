'use client';

import { useRef, useState } from 'react';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { SURVEY_QUESTION_TYPES, RATING_MAX, isChoiceType, type SurveyQuestionType, type SurveyQuestionView, type QuestionResult, type SurveyAnswerMap, type SurveyRespondentView } from '@/lib/survey';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  questionCount: number;
}
interface Props {
  eventId: number;
  ended: boolean;
  initialQuestions: SurveyQuestionView[];
  responseCount: number;
  templates: TemplateMeta[];
}

// A question in the editor. `key` is a stable client-side identity (existing rows reuse their db id,
// new rows get a counter) so React reconciles rows correctly across reorder/insert/delete.
interface EditQuestion {
  key: string;
  id?: number;
  type: SurveyQuestionType;
  prompt: string;
  options: string[];
  required: boolean;
}

const TYPE_LABELS: Record<SurveyQuestionType, string> = {
  rating: 'Rating (1–5)',
  text: 'Free text',
  single: 'Choose one',
  multi: 'Choose many',
};

function toEdit(q: SurveyQuestionView): EditQuestion {
  return { key: `q-${q.id}`, id: q.id, type: q.type, prompt: q.prompt, options: q.options, required: q.required };
}

export default function SurveyClient({ eventId, ended, initialQuestions, responseCount, templates }: Props) {
  const [tab, setTab] = useState<'build' | 'results'>('build');
  const [questions, setQuestions] = useState<EditQuestion[]>(initialQuestions.map(toEdit));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const newKey = useRef(0);

  function update(key: string, patch: Partial<EditQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }
  function addQuestion() {
    newKey.current += 1;
    setQuestions((qs) => [...qs, { key: `new-${newKey.current}`, type: 'text', prompt: '', options: [], required: false }]);
  }
  function removeQuestion(key: string) {
    setQuestions((qs) => qs.filter((q) => q.key !== key));
  }
  function move(key: string, dir: -1 | 1) {
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function changeType(key: string, type: SurveyQuestionType) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.key === key ? { ...q, type, options: isChoiceType(type) && q.options.length === 0 ? ['', ''] : q.options } : q,
      ),
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        questions: questions.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: isChoiceType(q.type) ? q.options.map((o) => o.trim()).filter(Boolean) : undefined,
          required: q.required,
        })),
      };
      const res = await clanFetch(`/api/events/${eventId}/survey/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Save failed');
        return;
      }
      setQuestions((data.questions as SurveyQuestionView[]).map(toEdit));
      setNotice('Survey saved.');
    } finally {
      setSaving(false);
    }
  }

  async function loadTemplate(id: string) {
    setError(null);
    setNotice(null);
    const res = await clanFetch(`/api/events/${eventId}/survey/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not load template');
      return;
    }
    setQuestions((data.questions as SurveyQuestionView[]).map(toEdit));
    setNotice('Template loaded — edit and save.');
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-lg font-semibold">Post-event survey</h2>
      </div>
      <p className="text-sm text-text-muted mb-4">
        {ended
          ? 'The event has ended — approved participants can fill this out now.'
          : 'Build the survey now; approved participants will be able to fill it out once the event ends.'}{' '}
        <ClanLink href={`/events/${eventId}/survey`} className="text-gold hover:underline" target="_blank">
          Preview the participant view ↗
        </ClanLink>
      </p>

      <div className="flex gap-1 mb-5 border-b border-card-border">
        {(['build', 'results'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'text-gold border-b-2 border-gold' : 'text-text-muted hover:text-foreground'}`}
          >
            {t === 'build' ? 'Build' : `Results${responseCount ? ` (${responseCount})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'build' ? (
        <div className="space-y-4">
          {questions.length === 0 && (
            <div className="rounded-xl border border-dashed border-card-border p-6 text-center">
              <p className="text-sm text-text-muted mb-3">No questions yet. Start from a template or add your own.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => loadTemplate(t.id)}
                title={t.description}
                className="text-xs font-medium bg-gold/10 text-gold border border-gold/25 px-3 py-1.5 rounded-lg hover:bg-gold/20 transition-colors"
              >
                Load “{t.name}” ({t.questionCount})
              </button>
            ))}
          </div>

          {questions.map((q, i) => (
            <div key={q.key} className="border border-card-border rounded-xl p-4 bg-card-bg space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-xs text-text-muted mt-2 w-5 shrink-0">{i + 1}.</span>
                <Input
                  value={q.prompt}
                  onChange={(e) => update(q.key, { prompt: e.target.value })}
                  placeholder="Question prompt"
                  className="flex-1"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => move(q.key, -1)} disabled={i === 0} className="text-text-muted hover:text-foreground disabled:opacity-30 px-1" title="Move up">↑</button>
                  <button onClick={() => move(q.key, 1)} disabled={i === questions.length - 1} className="text-text-muted hover:text-foreground disabled:opacity-30 px-1" title="Move down">↓</button>
                  <button onClick={() => removeQuestion(q.key)} className="text-red-400 hover:text-red-300 px-1" title="Delete question">✕</button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pl-7">
                <Select
                  value={q.type}
                  onChange={(v) => changeType(q.key, v as SurveyQuestionType)}
                  options={SURVEY_QUESTION_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
                  ariaLabel="Question type"
                  className="w-40"
                />
                <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                  <input type="checkbox" checked={q.required} onChange={(e) => update(q.key, { required: e.target.checked })} className="h-4 w-4 accent-gold" />
                  Required
                </label>
              </div>

              {isChoiceType(q.type) && (
                <div className="pl-7 space-y-1.5">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => update(q.key, { options: q.options.map((o, k) => (k === oi ? e.target.value : o)) })}
                        placeholder={`Option ${oi + 1}`}
                        className="flex-1 px-2 py-1.5 text-xs"
                      />
                      <button
                        onClick={() => update(q.key, { options: q.options.filter((_, k) => k !== oi) })}
                        className="text-text-muted hover:text-red-300 text-xs px-1"
                        title="Remove option"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => update(q.key, { options: [...q.options, ''] })}
                    className="text-xs text-gold/90 hover:text-gold"
                  >
                    + Add option
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={addQuestion} className="text-sm font-medium border border-card-border px-3 py-2 rounded-lg hover:border-gold/50 transition-colors">
              + Add question
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-sm font-semibold bg-gold/20 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/30 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save survey'}
            </button>
            {notice && <span className="text-xs text-accent-green-light">{notice}</span>}
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        </div>
      ) : (
        <ResultsView eventId={eventId} />
      )}
    </div>
  );
}

function ResultsView({ eventId }: { eventId: number }) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [respondents, setRespondents] = useState<SurveyRespondentView[]>([]);
  const [responseCount, setResponseCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'questions' | 'people'>('questions');
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/survey/results`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not load results');
        return;
      }
      setResults(data.results);
      setRespondents(data.respondents ?? []);
      setResponseCount(data.responseCount);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  if (!loaded) {
    return (
      <div className="text-center py-8">
        <button
          onClick={load}
          disabled={loading}
          className="text-sm font-semibold bg-gold/20 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/30 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load results'}
        </button>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    );
  }

  if (responseCount === 0) {
    return <p className="text-sm text-text-muted py-6 text-center">No responses yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-card-border overflow-hidden">
          {(['questions', 'people'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? 'bg-gold/20 text-gold' : 'text-text-muted hover:text-foreground'}`}
            >
              {v === 'questions' ? 'By question' : 'By person'}
            </button>
          ))}
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={view === 'questions' ? 'Filter text answers…' : 'Search people & answers…'}
          className="w-64 px-3 py-1.5 text-xs"
        />
        <span className="ml-auto text-xs text-text-muted">
          {responseCount} response{responseCount !== 1 ? 's' : ''}
        </span>
      </div>

      {view === 'questions' ? (
        <div className="space-y-5">
          {results.map((r) => (
            <div key={r.question.id} className="border border-card-border rounded-xl p-4 bg-card-bg">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold">{r.question.prompt}</h3>
                <span className="text-xs text-text-muted shrink-0">
                  {r.answered} answered
                  {r.average != null && ` · avg ${r.average.toFixed(1)}/${RATING_MAX}`}
                </span>
              </div>

              {r.question.type === 'text' ? (
                <TextAnswers texts={r.texts ?? []} filter={query} />
              ) : (
                <Bars counts={r.counts ?? {}} order={r.question.type === 'rating' ? Array.from({ length: RATING_MAX }, (_, i) => String(i + 1)) : r.question.options} answered={r.answered} rating={r.question.type === 'rating'} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <PeopleView respondents={respondents} questions={results.map((r) => r.question)} query={query} />
      )}
    </div>
  );
}

// "By person": every submission as an expandable card showing the respondent's full response —
// all questions in order with their complete (unclamped) answers. The search box matches
// respondent names and free-text answer content.
function PeopleView({
  respondents,
  questions,
  query,
}: {
  respondents: SurveyRespondentView[];
  questions: SurveyQuestionView[];
  query: string;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? respondents.filter(
        (p) =>
          (p.name ?? 'unknown').toLowerCase().includes(q) ||
          questions.some(
            (qq) => qq.type === 'text' && String(p.answers[qq.id] ?? '').toLowerCase().includes(q),
          ),
      )
    : respondents;

  if (filtered.length === 0) {
    return <p className="text-sm text-text-muted py-6 text-center">{q ? `No responses match “${query.trim()}”.` : 'No responses yet.'}</p>;
  }

  return (
    <div className="space-y-2">
      {q && filtered.length < respondents.length && (
        <p className="text-xs text-text-muted">
          {filtered.length} of {respondents.length} responses match “{query.trim()}”
        </p>
      )}
      {filtered.map((p, i) => {
        const answeredN = questions.filter((qq) => {
          const v = p.answers[qq.id];
          return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
        }).length;
        return (
          <details key={p.userId ?? `detached-${i}`} className="border border-card-border rounded-xl bg-card-bg group">
            <summary className="cursor-pointer select-none list-none flex items-center gap-3 p-3">
              <span className="text-sm font-semibold">{p.name ?? 'Unknown'}</span>
              <span className="ml-auto text-xs text-text-muted shrink-0">
                {answeredN}/{questions.length} answered · {p.submittedAt.slice(0, 10)}
              </span>
              <span className="text-text-muted transition-transform group-open:rotate-90">▸</span>
            </summary>
            <div className="border-t border-card-border p-3 space-y-3">
              {questions.map((qq) => (
                <div key={qq.id}>
                  <div className="text-xs text-text-muted mb-0.5">{qq.prompt}</div>
                  <AnswerValue question={qq} value={p.answers[qq.id]} />
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

// Render one answer for the per-person view: stars for ratings, chips for multi-choice, full
// text (line breaks preserved, never clamped) for free text.
function AnswerValue({ question, value }: { question: SurveyQuestionView; value: SurveyAnswerMap[number] | undefined }) {
  const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  if (empty) return <p className="text-xs text-text-muted/70 italic">No answer</p>;

  if (question.type === 'rating') {
    const n = Math.min(Math.max(1, Number(value) || 1), RATING_MAX);
    return (
      <p className="text-sm">
        <span className="text-gold">{'★'.repeat(n)}</span>
        <span className="text-text-muted/50">{'★'.repeat(RATING_MAX - n)}</span>
        <span className="text-xs text-text-muted ml-1.5">{n}/{RATING_MAX}</span>
      </p>
    );
  }
  if (question.type === 'multi') {
    return (
      <div className="flex flex-wrap gap-1">
        {(Array.isArray(value) ? value : [String(value)]).map((v) => (
          <span key={v} className="text-xs px-2 py-0.5 rounded-full border border-card-border bg-background">{v}</span>
        ))}
      </div>
    );
  }
  return <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{String(value)}</p>;
}

// Free-text results: one card per answer (name header + preserved line breaks) so 30 stacked
// textarea responses read as 30 distinct answers, not one wall of text. Long lists fold behind
// "Show all", long single answers clamp behind "Show more".
const TEXT_PREVIEW_COUNT = 8;

function TextAnswers({ texts, filter }: { texts: { respondentName: string | null; text: string }[]; filter: string }) {
  const [showAll, setShowAll] = useState(false);
  if (texts.length === 0) return <p className="text-xs text-text-muted">No answers.</p>;

  // Active search matches answer content or respondent name, and disables the preview fold —
  // when you're filtering you want every hit, not the first 8.
  const q = filter.trim().toLowerCase();
  const matches = q
    ? texts.filter((t) => t.text.toLowerCase().includes(q) || (t.respondentName ?? 'unknown').toLowerCase().includes(q))
    : texts;
  const visible = q || showAll ? matches : matches.slice(0, TEXT_PREVIEW_COUNT);

  return (
    <div className="space-y-2">
      {q && (
        <p className="text-xs text-text-muted">
          {matches.length === 0 ? 'No answers match' : `${matches.length} of ${texts.length} match`} “{filter.trim()}”
        </p>
      )}
      {visible.map((t, i) => (
        <TextAnswerCard key={i} respondentName={t.respondentName} text={t.text} />
      ))}
      {!q && matches.length > TEXT_PREVIEW_COUNT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-medium text-gold/90 hover:text-gold"
        >
          {showAll ? 'Show fewer' : `Show all ${matches.length} answers ↓`}
        </button>
      )}
    </div>
  );
}

// Clamp very long answers by character count (cheap and SSR-safe vs. measuring rendered
// lines); the cut lands on a word boundary via trimEnd so the ellipsis doesn't split a word.
const TEXT_CLAMP_CHARS = 400;

function TextAnswerCard({ respondentName, text }: { respondentName: string | null; text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > TEXT_CLAMP_CHARS;
  const shown = expanded || !isLong ? text : `${text.slice(0, TEXT_CLAMP_CHARS).trimEnd()}…`;
  return (
    <div className="rounded-lg border border-card-border bg-background px-3 py-2">
      <div className="text-xs font-semibold text-text-muted mb-1">{respondentName ?? 'Unknown'}</div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{shown}</p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-gold/90 hover:text-gold"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function Bars({ counts, order, answered, rating }: { counts: Record<string, number>; order: string[]; answered: number; rating: boolean }) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className="space-y-1.5">
      {order.map((key) => {
        const n = counts[key] ?? 0;
        const pct = Math.round((n / max) * 100);
        const share = answered > 0 ? Math.round((n / answered) * 100) : 0;
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate text-text-muted" title={key}>{rating ? `${key}★` : key}</span>
            <div className="flex-1 bg-background rounded h-4 overflow-hidden border border-card-border">
              <div className="h-full bg-gold/40" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-text-muted">{n} · {share}%</span>
          </div>
        );
      })}
    </div>
  );
}
