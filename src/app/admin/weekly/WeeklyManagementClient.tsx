'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SKILLS, SKILL_LABELS, BOSSES } from '@/lib/constants';
import DateRangeField from '@/components/DateRangeField';
import Select from '@/components/Select';
import Input from '@/components/Input';

interface Competition {
  id: number;
  type: string;
  metric: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  participantCount: number;
}

interface Participant {
  id: number;
  rsn: string;
  baselineValue: number | null;
  currentValue: number | null;
  lastUpdated: string | null;
  flagged: number;
  flagReason: string | null;
  keepIfLeft: number;
  leftAt: string | null;
  clanStatus: string | null;
}

export default function WeeklyManagementClient() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedComp, setExpandedComp] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Create form
  const [type, setType] = useState<'skill' | 'boss'>('skill');
  const [metric, setMetric] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Add RSNs
  const [addRsns, setAddRsns] = useState('');
  const [addingRsns, setAddingRsns] = useState(false);

  // Refresh
  const [refreshing, setRefreshing] = useState<number | null>(null);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);

  // Baseline correction (fix flagged / implausible gains)
  const [fixingId, setFixingId] = useState<number | null>(null);
  const [fixValue, setFixValue] = useState('');
  const [savingFix, setSavingFix] = useState(false);

  // Edit
  const [editingComp, setEditingComp] = useState<Competition | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  async function fetchCompetitions() {
    const res = await fetch('/api/admin/weekly');
    if (res.ok) {
      setCompetitions(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchCompetitions();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    const res = await fetch('/api/admin/weekly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, metric, title, startDate, endDate }),
    });

    if (!res.ok) {
      const data = await res.json();
      setCreateError(data.error || 'Failed to create');
      setCreating(false);
      return;
    }

    setShowCreate(false);
    setTitle('');
    setMetric('');
    setStartDate('');
    setEndDate('');
    setCreating(false);
    fetchCompetitions();
  }

  async function loadParticipants(compId: number) {
    if (expandedComp === compId) {
      setExpandedComp(null);
      return;
    }
    setExpandedComp(compId);
    setLoadingParticipants(true);
    setRefreshResult(null);

    const res = await fetch(`/api/admin/weekly/${compId}/participants`);
    if (res.ok) {
      setParticipants(await res.json());
    }
    setLoadingParticipants(false);
  }

  async function handleAddRsns(compId: number) {
    if (!addRsns.trim()) return;
    setAddingRsns(true);

    const rsns = addRsns.split(/[,\n]/).map((r) => r.trim()).filter(Boolean);
    const res = await fetch(`/api/admin/weekly/${compId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rsns }),
    });

    if (res.ok) {
      setAddRsns('');
      loadParticipants(compId);
    }
    setAddingRsns(false);
  }

  async function handleRefresh(compId: number) {
    setRefreshing(compId);
    setRefreshResult(null);

    const res = await fetch(`/api/admin/weekly/${compId}/refresh`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setRefreshResult(`Updated ${data.updated}/${data.total} participants. ${data.errors.length ? `Errors: ${data.errors.join(', ')}` : ''}`);
      loadParticipants(compId);
    } else {
      setRefreshResult('Refresh failed');
    }
    setRefreshing(null);
  }

  function startFix(p: Participant) {
    setFixingId(p.id);
    // Default to the current value: setting baseline = current zeroes the bogus
    // pre-event gain and counts only progress from here on.
    setFixValue(String(p.currentValue ?? p.baselineValue ?? 0));
  }

  // Re-include (or drop again) a participant whose clan_member left the CC mid-comp.
  async function toggleKeep(compId: number, p: Participant) {
    const res = await fetch(`/api/admin/weekly/${compId}/participants`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: p.id, keepIfLeft: p.keepIfLeft !== 1 }),
    });
    if (res.ok) loadParticipants(compId);
  }

  async function handleSaveFix(compId: number) {
    if (fixingId === null) return;
    const baselineValue = Number(fixValue);
    if (!Number.isFinite(baselineValue) || baselineValue < 0) return;
    setSavingFix(true);

    const res = await fetch(`/api/admin/weekly/${compId}/participants`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: fixingId, baselineValue }),
    });

    if (res.ok) {
      setFixingId(null);
      setFixValue('');
      loadParticipants(compId);
    }
    setSavingFix(false);
  }

  async function handleDelete(compId: number) {
    if (!confirm('Delete this competition? This cannot be undone.')) return;

    const res = await fetch(`/api/admin/weekly/${compId}`, { method: 'DELETE' });
    if (res.ok) {
      fetchCompetitions();
      if (expandedComp === compId) setExpandedComp(null);
    }
  }

  function startEdit(comp: Competition) {
    setEditingComp(comp);
    setEditTitle(comp.title);
    setEditStartDate(comp.startDate);
    setEditEndDate(comp.endDate);
    setEditStatus(comp.status);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingComp) return;
    setEditSaving(true);

    const res = await fetch(`/api/admin/weekly/${editingComp.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle,
        startDate: editStartDate,
        endDate: editEndDate,
        status: editStatus,
      }),
    });

    if (res.ok) {
      setEditingComp(null);
      fetchCompetitions();
    }
    setEditSaving(false);
  }

  function getMetricLabel(type: string, metric: string): string {
    if (type === 'skill') return SKILL_LABELS[metric] || metric;
    const boss = BOSSES.find((b) => b.key === metric);
    return boss?.label || metric;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-green/15 text-accent-green-light">Active</span>;
      case 'upcoming':
        return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">Upcoming</span>;
      case 'completed':
        return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-text-muted/15 text-text-muted">Completed</span>;
      default:
        return null;
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-text-muted">Loading...</div>;
  }

  const active = competitions.filter((c) => c.status === 'active');
  const upcoming = competitions.filter((c) => c.status === 'upcoming');
  const completed = competitions.filter((c) => c.status === 'completed');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gold">Weekly Competitions</h1>
          <p className="text-text-muted text-sm mt-1">Skill of the Week / Boss of the Week</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/weekly"
            className="px-3 py-1.5 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
          >
            Public View
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-1.5 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors"
          >
            + Create
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editingComp && (
        <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <h2 className="text-lg font-bold mb-4">Edit Competition</h2>
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Title</label>
              <Input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
              />
            </div>
            <DateRangeField
              startIso={editStartDate}
              endIso={editEndDate}
              onChange={({ startIso, endIso }) => {
                setEditStartDate(startIso);
                setEditEndDate(endIso);
              }}
            />
            <div>
              <label className="block text-xs text-text-muted mb-1">Status</label>
              <Select
                value={editStatus}
                onChange={setEditStatus}
                ariaLabel="Status"
                options={[
                  { value: 'upcoming', label: 'Upcoming' },
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                ]}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingComp(null)}
                className="px-4 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <h2 className="text-lg font-bold mb-4">Create Competition</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setType('skill'); setMetric(''); }}
                  className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                    type === 'skill' ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
                  }`}
                >
                  Skill of the Week
                </button>
                <button
                  type="button"
                  onClick={() => { setType('boss'); setMetric(''); }}
                  className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                    type === 'boss' ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
                  }`}
                >
                  Boss of the Week
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                {type === 'skill' ? 'Skill' : 'Boss'}
              </label>
              <Select
                value={metric}
                onChange={setMetric}
                required
                placeholder={`Select ${type === 'skill' ? 'a skill' : 'a boss'}...`}
                ariaLabel={type === 'skill' ? 'Skill' : 'Boss'}
                options={
                  type === 'skill'
                    ? SKILLS.map((key) => ({ value: key, label: SKILL_LABELS[key] || key }))
                    : BOSSES.map((b) => ({ value: b.key, label: b.label }))
                }
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">Title</label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                placeholder="e.g. Skill of the Week: Mining"
              />
            </div>

            <DateRangeField
              startIso={startDate}
              endIso={endDate}
              onChange={({ startIso, endIso }) => {
                setStartDate(startIso);
                setEndDate(endIso);
              }}
              required
            />


            {createError && <p className="text-red-400 text-sm">{createError}</p>}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Competition'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Competition lists */}
      {[
        { label: 'Active', comps: active, color: 'bg-accent-green' },
        { label: 'Upcoming', comps: upcoming, color: 'bg-blue-500' },
        { label: 'Completed', comps: completed, color: 'bg-text-muted' },
      ].map(({ label, comps, color }) => (
        comps.length > 0 && (
          <div key={label} className="mb-8">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className={`w-1 h-5 ${color} rounded-full`} />
              {label}
            </h2>
            <div className="space-y-2">
              {comps.map((comp) => (
                <div key={comp.id} className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-card-bg-hover transition-colors"
                    onClick={() => loadParticipants(comp.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{comp.title}</span>
                        {getStatusBadge(comp.status)}
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gold/15 text-gold">
                          {comp.type === 'skill' ? 'Skill' : 'Boss'}: {getMetricLabel(comp.type, comp.metric)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                        <span>{comp.participantCount} participants</span>
                        <span>{new Date(comp.startDate).toLocaleDateString()} - {new Date(comp.endDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(comp); }}
                        className="px-2 py-1 text-xs border border-card-border rounded hover:border-gold/40 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(comp.id); }}
                        className="px-2 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                      <Link
                        href={`/weekly/${comp.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1 text-xs border border-card-border rounded hover:border-gold/40 transition-colors"
                      >
                        Leaderboard
                      </Link>
                      <span className="text-text-muted">{expandedComp === comp.id ? '▼' : '▶'}</span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedComp === comp.id && (
                    <div className="border-t border-card-border p-4 space-y-4">
                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleRefresh(comp.id)}
                          disabled={refreshing === comp.id}
                          className="px-3 py-1.5 text-xs font-semibold bg-gold/20 border border-gold text-gold rounded hover:bg-gold/30 disabled:opacity-50 transition-colors"
                        >
                          {refreshing === comp.id ? 'Refreshing...' : 'Refresh Stats'}
                        </button>
                      </div>
                      {refreshResult && (
                        <p className="text-xs text-text-muted">{refreshResult}</p>
                      )}

                      {/* Add RSNs */}
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Add RSNs (comma or newline separated)</label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            value={addRsns}
                            onChange={(e) => setAddRsns(e.target.value)}
                            placeholder="player1, player2"
                            className="flex-1 px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                          />
                          <button
                            onClick={() => handleAddRsns(comp.id)}
                            disabled={addingRsns}
                            className="px-3 py-2 text-xs font-semibold bg-gold/20 border border-gold text-gold rounded hover:bg-gold/30 disabled:opacity-50 transition-colors"
                          >
                            {addingRsns ? '...' : 'Add'}
                          </button>
                        </div>
                      </div>

                      {/* Participants table */}
                      {loadingParticipants ? (
                        <p className="text-text-muted text-sm">Loading participants...</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-text-muted border-b border-card-border">
                                <th className="px-3 py-2 font-medium">RSN</th>
                                <th className="px-3 py-2 font-medium">Baseline</th>
                                <th className="px-3 py-2 font-medium">Current</th>
                                <th className="px-3 py-2 font-medium">Gained</th>
                                <th className="px-3 py-2 font-medium">Last Updated</th>
                                <th className="px-3 py-2 font-medium"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {participants
                                .sort((a, b) => ((b.currentValue ?? 0) - (b.baselineValue ?? 0)) - ((a.currentValue ?? 0) - (a.baselineValue ?? 0)))
                                .map((p) => {
                                  const gained = (p.currentValue ?? 0) - (p.baselineValue ?? 0);
                                  const isFlagged = p.flagged === 1;
                                  const hasLeft = p.leftAt != null;
                                  const kept = p.keepIfLeft === 1;
                                  const dropped = hasLeft && !kept;
                                  return (
                                    <tr key={p.id} className={`border-b border-card-border/50 ${isFlagged ? 'bg-red-500/5' : ''} ${dropped ? 'opacity-50' : ''}`}>
                                      <td className="px-3 py-2 font-medium">
                                        <div className="flex items-center gap-1.5">
                                          {p.rsn}
                                          {isFlagged && (
                                            <span
                                              title={p.flagReason ?? 'Implausible gain — likely pre-event progress swept in by a stale baseline.'}
                                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 cursor-help"
                                            >
                                              ⚠ Implausible
                                            </span>
                                          )}
                                          {hasLeft && (
                                            <span
                                              title={kept ? 'Left the CC but kept on the leaderboard by an admin override.' : 'Left the CC — excluded from the leaderboard and headcount.'}
                                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full cursor-help ${kept ? 'bg-gold/15 text-gold' : 'bg-text-muted/15 text-text-muted'}`}
                                            >
                                              {kept ? '↩ Kept (left CC)' : '✖ Left CC'}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-text-muted">
                                        {p.baselineValue?.toLocaleString() ?? '-'}
                                      </td>
                                      <td className="px-3 py-2 text-text-muted">
                                        {p.currentValue?.toLocaleString() ?? '-'}
                                      </td>
                                      <td className={`px-3 py-2 font-medium ${isFlagged ? 'text-red-400' : gained > 0 ? 'text-accent-green-light' : 'text-text-muted'}`}>
                                        {p.baselineValue !== null ? `+${gained.toLocaleString()}` : '-'}
                                      </td>
                                      <td className="px-3 py-2 text-text-muted text-xs">
                                        {p.lastUpdated ? new Date(p.lastUpdated).toLocaleString() : 'Never'}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {fixingId === p.id ? (
                                          <div className="flex items-center gap-1.5 justify-end">
                                            <Input
                                              type="number"
                                              value={fixValue}
                                              onChange={(e) => setFixValue(e.target.value)}
                                              className="w-28 px-2 py-1 bg-brown-dark border border-card-border rounded text-xs"
                                            />
                                            <button
                                              onClick={() => handleSaveFix(comp.id)}
                                              disabled={savingFix}
                                              className="px-2 py-1 text-xs font-semibold bg-gold/20 border border-gold text-gold rounded hover:bg-gold/30 disabled:opacity-50 transition-colors"
                                            >
                                              {savingFix ? '...' : 'Save'}
                                            </button>
                                            <button
                                              onClick={() => { setFixingId(null); setFixValue(''); }}
                                              className="px-2 py-1 text-xs border border-card-border rounded hover:border-gold/40 transition-colors"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5 justify-end">
                                            {hasLeft && (
                                              <button
                                                onClick={() => toggleKeep(comp.id, p)}
                                                title={kept ? 'Drop this leaver from the leaderboard again' : 'Keep this leaver on the leaderboard'}
                                                className={`px-2 py-1 text-xs border rounded transition-colors ${kept ? 'border-gold/40 text-gold hover:bg-gold/10' : 'border-card-border text-text-muted hover:border-gold/40'}`}
                                              >
                                                {kept ? 'Drop' : 'Keep'}
                                              </button>
                                            )}
                                            {p.baselineValue !== null && (
                                              <button
                                                onClick={() => startFix(p)}
                                                title="Correct this participant's baseline"
                                                className={`px-2 py-1 text-xs border rounded transition-colors ${isFlagged ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-card-border text-text-muted hover:border-gold/40'}`}
                                              >
                                                Fix baseline
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              {participants.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                                    No participants enrolled yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {competitions.length === 0 && (
        <div className="text-center py-12 border border-dashed border-card-border rounded-xl">
          <p className="text-text-muted">No competitions yet. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
