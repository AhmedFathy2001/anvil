'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SetupStep } from '@/lib/setupStatus';

interface Props {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
}

// Dashboard "finish setting up" card. Rendered by the dashboard only while setup is
// incomplete and un-dismissed; step status is computed live upstream so it never lies.
// Dismissing persists the advisory `setup_completed` flag and hides the card.
export default function SetupChecklist({ steps, completedCount, totalCount }: Props) {
  const [hidden, setHidden] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  async function dismiss() {
    setDismissing(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup_completed: '1' }),
      });
    } catch {
      /* non-fatal — worst case the card returns next load */
    }
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <section className="mb-8 border border-gold/30 rounded-xl bg-gold/5 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2 text-gold">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Finish setting up Anvil
          </h2>
          <p className="text-xs text-text-muted mt-1">
            {completedCount} of {totalCount} done — get your clan ready to run its first bingo.
          </p>
        </div>
        <button
          onClick={dismiss}
          disabled={dismissing}
          className="text-xs text-text-muted hover:text-foreground transition-colors shrink-0 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-card-border mb-4 overflow-hidden">
        <div
          className="h-full bg-gold rounded-full transition-all"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-card-bg-hover transition-colors group"
            >
              <span
                className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                  step.done
                    ? 'bg-accent-green/20 text-accent-green-light border-accent-green/40'
                    : 'border-card-border text-text-muted'
                }`}
              >
                {step.done ? '✓' : ''}
              </span>
              <span className="min-w-0">
                <span
                  className={`text-sm font-medium ${
                    step.done ? 'text-text-muted line-through' : 'group-hover:text-gold transition-colors'
                  }`}
                >
                  {step.label}
                </span>
                {!step.done && <span className="block text-xs text-text-muted">{step.hint}</span>}
              </span>
              {!step.done && (
                <span className="ml-auto text-text-muted text-sm group-hover:text-gold transition-colors">→</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
