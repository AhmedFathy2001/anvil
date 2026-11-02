'use client';

import { useState } from 'react';
import { AGILITY_COURSES, SEPULCHRE_TARGETS, lapUnitNoun } from '@/lib/constants';
import {
  TRIAL_COURSE_OPTIONS,
  TRIAL_RANK_OPTIONS_UI,
  howItCountsLine,
  trialTileConfig,
} from '@/lib/tileCreatorConfig';
import type { TaskCandidate } from '@/lib/taskMatch';
import { AmountField, ChoiceButton, CountsBanner, Eyebrow, PrimaryButton, StepHeader } from './parts';

type Tab = 'trials' | 'agility' | 'sepulchre';

/**
 * Courses & trials: Barracuda Trials as course × rank (each rank is its own route, gated on the
 * rank the game announces, never a time cap), agility courses by their lap counter, and the
 * Hallowed Sepulchre by floor.
 */
export default function CoursesStep({
  seed,
  amount: initialAmount,
  onBack,
  onNext,
}: {
  seed?: { trial?: { course: string | null; rank: string | null }; courses?: string[] };
  amount: number | null;
  onBack: () => void;
  onNext: (candidate: TaskCandidate) => void;
}) {
  const [tab, setTab] = useState<Tab>(seed?.courses?.length ? (seed.courses.some((c) => c.includes('Sepulchre') || c.includes('Coffin')) ? 'sepulchre' : 'agility') : 'trials');
  const [course, setCourse] = useState<string | null>(seed?.trial?.course ?? null);
  const [rank, setRank] = useState<string | null>(seed?.trial?.rank ?? null);
  const [courses, setCourses] = useState<string[]>(seed?.courses ?? []);
  const [amount, setAmount] = useState<number | null>(initialAmount ?? (tab === 'trials' ? 1 : 50));
  const n = amount && amount > 0 ? amount : 1;

  const trialConfig = course && rank ? trialTileConfig(course, rank, n) : null;
  const courseLabel = TRIAL_COURSE_OPTIONS.find((c) => c.id === course)?.label.replace(/^The /, '') ?? '';
  const rankLabel = TRIAL_RANK_OPTIONS_UI.find((r) => r.id === rank)?.label ?? '';

  const lapTargets = tab === 'trials' ? [] : courses.filter((c) => (tab === 'sepulchre') === SEPULCHRE_TARGETS.some((t) => t.name === c));
  const unit = lapUnitNoun(lapTargets);
  const lapLabel = (name: string) =>
    AGILITY_COURSES.find((c) => c.name === name)?.label ?? `Sepulchre ${SEPULCHRE_TARGETS.find((t) => t.name === name)?.label ?? name}`;

  function next() {
    if (tab === 'trials') {
      if (!trialConfig) return;
      const how = howItCountsLine(trialConfig);
      const titleOne = `${courseLabel}, ${rankLabel}`;
      onNext({
        key: `trial-${course}-${rank}`,
        source: 'trial',
        badge: 'Trial',
        title: n === 1 ? titleOne : `${n} × ${titleOne}`,
        titleTemplate: `{n} × ${titleOne}`,
        titleOne,
        hint: how.text,
        engine: how.engine,
        verb: 'Complete',
        noun: `${courseLabel} runs on ${rankLabel}`,
        amountField: 'requiredAmount',
        amount: n,
        config: trialConfig,
        flow: 'trials',
        seed: { trial: { course, rank } },
        category: 'courses',
        score: 0,
        confident: true,
      });
      return;
    }
    if (lapTargets.length === 0) return;
    const config = { tileType: 'lap', targetNpcs: lapTargets, requiredAmount: n };
    const how = howItCountsLine(config);
    const where = lapTargets.length === 1 ? lapLabel(lapTargets[0]) : `${lapTargets.length} ${tab === 'agility' ? 'courses' : 'Sepulchre targets'}`;
    const nounPlural = unit === 'lap' ? 'laps' : unit === 'floor' ? 'floors' : 'runs';
    onNext({
      key: `lap-${lapTargets.join('+')}`,
      source: 'lap',
      badge: tab === 'agility' ? 'Laps' : 'Sepulchre',
      title: `${n.toLocaleString('en-US')} ${where} ${nounPlural}`,
      titleTemplate: `{n} ${where} ${nounPlural}`,
      hint: how.text,
      engine: how.engine,
      verb: unit === 'lap' ? 'Run' : 'Clear',
      noun: `${nounPlural} (${where})`,
      amountField: 'requiredAmount',
      amount: n,
      config,
      flow: 'courses',
      seed: { courses: lapTargets },
      category: 'courses',
      score: 0,
      confident: true,
    });
  }

  const ready = tab === 'trials' ? !!trialConfig : lapTargets.length > 0;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'trials', label: 'Barracuda Trials' },
    { id: 'agility', label: 'Agility' },
    { id: 'sepulchre', label: 'Sepulchre' },
  ];

  return (
    <div>
      <StepHeader title="Courses & trials" onBack={onBack} />
      <div role="group" aria-label="Kind of course" className="grid grid-cols-3 gap-1.5 mb-5">
        {tabs.map((t) => (
          <ChoiceButton key={t.id} pressed={tab === t.id} onClick={() => setTab(t.id)} className="text-xs px-2">
            {t.label}
          </ChoiceButton>
        ))}
      </div>

      {tab === 'trials' && (
        <>
          <Eyebrow>Course</Eyebrow>
          <div className="space-y-2 mb-5">
            {TRIAL_COURSE_OPTIONS.map((c) => (
              <ChoiceButton key={c.id} pressed={course === c.id} onClick={() => setCourse(c.id)} className="w-full flex items-center justify-between text-left">
                <span className="font-medium">{c.label}</span>
                <span className="text-xs text-text-muted">Sailing {c.level}</span>
              </ChoiceButton>
            ))}
          </div>
          <Eyebrow>Rank (each is its own route)</Eyebrow>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {TRIAL_RANK_OPTIONS_UI.map((r) => (
              <ChoiceButton key={r.id} pressed={rank === r.id} onClick={() => setRank(r.id)} className="flex flex-col items-center leading-tight">
                <span className="font-medium">{r.label}</span>
                <span className="text-[11px] text-text-muted">{r.unlock}</span>
              </ChoiceButton>
            ))}
          </div>
          <Eyebrow>Players must</Eyebrow>
          <div className="flex flex-wrap items-center gap-2 text-base mb-1">
            <span>Complete it</span>
            <AmountField value={amount} onChange={setAmount} label="Runs needed" />
            <span>times{rankLabel ? ` on ${rankLabel}` : ''}</span>
          </div>
          <p className="text-xs text-text-muted mb-4">
            Across any number of sessions.
            {rankLabel
              ? ` ${TRIAL_RANK_OPTIONS_UI.filter((r) => r.id !== rank).map((r) => r.label).join(' and ')} runs don’t count.`
              : ''}
          </p>
          {trialConfig && <CountsBanner {...howItCountsLine(trialConfig)} />}
        </>
      )}

      {tab !== 'trials' && (
        <>
          <Eyebrow>{tab === 'agility' ? 'Which courses count (any of them)' : 'What counts'}</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5 max-h-72 overflow-y-auto pr-1">
            {(tab === 'agility'
              ? [...AGILITY_COURSES].sort((a, b) => a.level - b.level).map((c) => ({ name: c.name, label: c.label, level: c.level }))
              : SEPULCHRE_TARGETS.map((t) => ({ name: t.name, label: t.label, level: t.level }))
            ).map((c) => {
              const on = courses.includes(c.name);
              return (
                <ChoiceButton
                  key={c.name}
                  pressed={on}
                  onClick={() =>
                    setCourses((prev) =>
                      tab === 'sepulchre'
                        ? on ? prev.filter((x) => x !== c.name) : [...prev.filter((x) => !SEPULCHRE_TARGETS.some((t) => t.name === x)), c.name]
                        : on ? prev.filter((x) => x !== c.name) : [...prev, c.name],
                    )
                  }
                  className="flex items-center justify-between text-left"
                >
                  <span>{c.label}</span>
                  <span className="text-[11px] text-text-muted">Agility {c.level}</span>
                </ChoiceButton>
              );
            })}
          </div>
          <Eyebrow>Players must</Eyebrow>
          <div className="flex flex-wrap items-center gap-2 text-base mb-4">
            <span>{unit === 'lap' ? 'Run' : 'Clear'}</span>
            <AmountField value={amount} onChange={setAmount} label={unit === 'lap' ? 'Laps needed' : 'Floors needed'} />
            <span>{unit === 'lap' ? 'laps' : unit === 'floor' ? 'floors' : 'full runs'}</span>
          </div>
          {lapTargets.length > 0 && <CountsBanner {...howItCountsLine({ tileType: 'lap', targetNpcs: lapTargets })} />}
        </>
      )}

      <div className="mt-6 flex justify-end">
        <PrimaryButton onClick={next} disabled={!ready}>
          Next: points
        </PrimaryButton>
      </div>
    </div>
  );
}
