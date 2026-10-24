'use client';

import { useEffect, useState } from 'react';

interface Scenario {
  name: string;
  description: string;
  params?: Record<string, string>;
  steps: unknown[];
}

const BLANK: Scenario = {
  name: '',
  description: '',
  params: { boss: 'Vorkath', kc: '50' },
  steps: [{ chat: { message: 'Your ${boss} kill count is: ${kc}.' } }, { wait: 1 }],
};

export default function ScenariosClient() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [templates, setTemplates] = useState<Scenario[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [paramsText, setParamsText] = useState('{}');
  const [stepsText, setStepsText] = useState('[]');
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch('/api/staff/lab/scenarios');
    if (res.ok) {
      const data = await res.json();
      setScenarios(data.scenarios);
      setTemplates(data.templates);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
    void load();
  }, []);

  function edit(s: Scenario) {
    setName(s.name);
    setDescription(s.description ?? '');
    setParamsText(JSON.stringify(s.params ?? {}, null, 2));
    setStepsText(JSON.stringify(s.steps, null, 2));
    setMessage('');
  }

  async function save() {
    let params: unknown;
    let steps: unknown;
    try {
      params = JSON.parse(paramsText || '{}');
      steps = JSON.parse(stepsText);
    } catch (e) {
      setMessage(`Not valid JSON: ${(e as Error).message}`);
      return;
    }
    const res = await fetch('/api/staff/lab/scenarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, params, steps }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Saved. Run ::anvil sync in the dev client to pull it.' : data.error ?? 'Failed');
    if (res.ok) await load();
  }

  async function remove(n: string) {
    await fetch(`/api/staff/lab/scenarios?name=${encodeURIComponent(n)}`, { method: 'DELETE' });
    await load();
  }

  const field = 'mt-1 w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm';
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gold">On the site</h2>
          {scenarios.length === 0 ? (
            <p className="text-xs text-text-muted">None yet — start from a template.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {scenarios.map((s) => (
                <li key={s.name} className="flex items-center gap-2">
                  <button type="button" className="font-mono text-gray-200 hover:text-gold" onClick={() => edit(s)}>{s.name}</button>
                  <button type="button" className="ml-auto text-xs text-text-muted hover:text-red-400" onClick={() => remove(s.name)}>delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gold">Templates (bundled with the harness)</h2>
          <ul className="space-y-1 text-sm">
            <li>
              <button type="button" className="text-gray-300 hover:text-gold" onClick={() => edit(BLANK)}>blank</button>
            </li>
            {templates.map((t) => (
              <li key={t.name}>
                <button type="button" className="font-mono text-gray-300 hover:text-gold" title={t.description} onClick={() => edit({ ...t, name: `${t.name}-copy` })}>
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-300">
            Name
            <input className={`${field} font-mono`} value={name} onChange={(e) => setName(e.target.value)} placeholder="maggot-king-pet" />
          </label>
          <label className="text-sm text-gray-300">
            Description
            <input className={field} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        <label className="mt-3 block text-sm text-gray-300">
          Params <span className="text-xs text-text-muted">— string defaults for <code>${'{key}'}</code>; <code>${'{me}'}</code> is always your RSN</span>
          <textarea className={`${field} h-24 font-mono`} value={paramsText} onChange={(e) => setParamsText(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm text-gray-300">
          Steps
          <textarea className={`${field} h-96 font-mono text-xs`} value={stepsText} onChange={(e) => setStepsText(e.target.value)} spellCheck={false} />
        </label>
        <details className="mt-2 text-xs text-text-muted">
          <summary className="cursor-pointer">Step reference</summary>
          <ul className="mt-2 space-y-1 font-mono">
            <li>{'{ "wait": 2 }'} — game ticks</li>
            <li>{'{ "chat": { "type": "GAMEMESSAGE", "message": "…", "name"?: "", "sender"?: "" } }'}</li>
            <li>{'{ "loot": { "kind": "npc|server|generic", "name": "Vorkath", "npcId"?: 8061, "items": [{ "id": 11286, "qty": 1 }] } }'}</li>
            <li>{'{ "varbit": { "id" | "name": "…", "value": 1 } }'}</li>
            <li>{'{ "stat": { "skill": "Slayer", "xp": 13034431, "level": 99 } }'}</li>
            <li>{'{ "death": { "who": "self" } }'} or {'{ "death": { "who": "npc", "name": "…" } }'}</li>
            <li>{'{ "pvpKill": { "victim": "Someone", "damage"?: 20 } }'}</li>
          </ul>
        </details>
        {message && <p className="mt-3 text-sm text-gray-200">{message}</p>}
        <button type="button" onClick={save} disabled={!name} className="mt-4 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark disabled:opacity-50">
          Save
        </button>
      </section>
    </div>
  );
}
