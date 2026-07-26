'use client';

import { useEffect, useRef, useState } from 'react';
import type { EventRecap, RecapAward, RecapEntry } from '@/lib/eventRecap';

// Split a pre-formatted value label ("1,204 kills", "51,200,000 gp") into an integer to count up and
// the trailing unit. Non-numeric labels (a raid time like "1:23") animate nothing — count is null.
function splitLabel(label: string): { count: number | null; prefix: string; suffix: string } {
  const m = label.match(/^([\d,]+)(.*)$/);
  if (!m) return { count: null, prefix: '', suffix: label };
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return { count: null, prefix: '', suffix: label };
  return { count: n, prefix: '', suffix: m[2] };
}

// Count a headline number up from 0 the first time the card scrolls into view. Respects
// prefers-reduced-motion (jumps straight to the final value). Falls back to the raw label for
// non-numeric values (times). Renders 0 on the server / first client paint (deterministic, so no
// hydration mismatch); every update below runs in an async rAF / observer callback.
function CountUp({ label, className }: { label: string; className?: string }) {
  const { count, suffix } = splitLabel(label);
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (count == null) return;
    const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const run = () => {
      if (started.current) return;
      started.current = true;
      if (reduce) {
        raf = requestAnimationFrame(() => setShown(count));
        return;
      }
      const duration = 900;
      let startTs: number | null = null;
      const tick = (ts: number) => {
        if (startTs == null) startTs = ts;
        const p = Math.min(1, (ts - startTs) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        setShown(Math.round(count * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const el = ref.current;
    if (!el) {
      // ref should always be attached, but never leave the value stuck at 0 if it isn't.
      raf = requestAnimationFrame(() => setShown(count));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [count]);

  if (count == null) return <span className={className}>{suffix}</span>;
  return (
    <span ref={ref} className={className}>
      {shown.toLocaleString()}
      {suffix}
    </span>
  );
}

function TeamDot({ color }: { color: string | null }) {
  if (!color) return null;
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

function Runner({ entry }: { entry: RecapEntry }) {
  return (
    <li className="flex items-center justify-between gap-2 text-xs text-text-muted">
      <span className="flex items-center gap-1.5 min-w-0">
        <TeamDot color={entry.teamColor} />
        <span className="truncate">{entry.name}</span>
      </span>
      <span className="shrink-0 tabular-nums">{entry.valueLabel}</span>
    </li>
  );
}

function AwardCard({ award }: { award: RecapAward }) {
  const w = award.winner;
  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none" aria-hidden>{award.emoji}</span>
        <div className="min-w-0">
          <p className="font-bold text-gold leading-tight">{award.title}</p>
          <p className="text-xs text-text-muted leading-tight">{award.blurb}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <TeamDot color={w.teamColor} />
          <span className="font-semibold truncate">{w.name}</span>
        </div>
        <CountUp label={w.valueLabel} className="text-2xl font-extrabold text-text tabular-nums" />
        {w.detail && <p className="text-xs text-text-muted mt-0.5 truncate">{w.detail}</p>}
      </div>

      {award.runnersUp.length > 0 && (
        <ul className="border-t border-card-border pt-2 space-y-1">
          {award.runnersUp.map((r, i) => (
            <Runner key={i} entry={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TotalPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3 text-center">
      <p className="text-xl font-extrabold text-gold tabular-nums">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

export default function RecapClient({ recap, preview }: { recap: EventRecap; preview: boolean }) {
  const t = recap.totals;
  return (
    <div className="space-y-6">
      {preview && (
        <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
          Staff preview — these awards keep changing until the event ends.
        </div>
      )}

      {t && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TotalPill value={t.contenders.toLocaleString()} label="players in the running" />
          <TotalPill value={t.tilesCompleted.toLocaleString()} label="tiles completed" />
          <TotalPill value={t.submissions.toLocaleString()} label="submissions" />
          <TotalPill value={`${t.gpLooted.toLocaleString()} gp`} label="tracked loot value" />
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="text-lg font-bold">Superlatives</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recap.awards.map((a) => (
            <AwardCard key={a.key} award={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
