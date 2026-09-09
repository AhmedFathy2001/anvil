'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Input from '@/components/Input';
import Select from '@/components/Select';
import DateRangeField from '@/components/DateRangeField';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import { useDialog } from '@/components/Confirm';

/**
 * Renaming, re-dating and deleting a competition — from the competition.
 *
 * These three were the last things keeping the old /admin/weekly page alive. They lived in a modal
 * on a list, which is where you edit something you have not opened; every other fact about a
 * competition — its roster, its baselines, its prizes, its standings — is on the workspace, so
 * changing its dates meant leaving the thing you were looking at, finding it again in a second
 * list, and editing it there.
 *
 * A board keeps this on a Settings tab. So does this now.
 */
export default function WeeklySettingsPanel({
  comp,
  canDelete,
}: {
  comp: { id: number; title: string; startDate: string; endDate: string; status: string };
  /** Deleting takes the standings with it, so it is an admin's call rather than a moderator's. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const { confirm, notify } = useDialog();
  const [title, setTitle] = useState(comp.title);
  const [startDate, setStartDate] = useState(comp.startDate);
  const [endDate, setEndDate] = useState(comp.endDate);
  const [status, setStatus] = useState(comp.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dirty =
    title !== comp.title ||
    startDate !== comp.startDate ||
    endDate !== comp.endDate ||
    status !== comp.status;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${comp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, startDate, endDate, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: data.error || 'Could not save that.' });
        return;
      }
      setMessage({ type: 'success', text: 'Saved.' });
      router.refresh();
    } catch {
      setMessage({ type: 'error', text: 'Could not save that.' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete “${comp.title}”?`,
      body: 'Its participants, baselines and standings go with it. There is no undo.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await clanFetch(`/api/admin/weekly/${comp.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(data.error || `Delete failed (HTTP ${res.status}).`, 'error');
        setDeleting(false);
        return;
      }
      router.push(clanUrl('/admin/events'));
      router.refresh();
    } catch {
      notify('Could not delete that.', 'error');
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Name, dates and status
      </h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="weekly-title" className="mb-1.5 block text-sm font-medium text-foreground/70">
            Title
          </label>
          <Input
            id="weekly-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2"
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

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/70">Status</label>
          <Select
            value={status}
            onChange={setStatus}
            ariaLabel="Competition status"
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
            ]}
            className="w-56"
          />
          {/* The lifecycle cron writes this on its own; setting it by hand is the repair for a
              competition that got stuck, not the normal way one moves along. */}
          <p className="mt-1.5 text-xs text-text-muted">
            The weekly cron moves this along on its own. Set it by hand only to unstick one.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {message && (
            <span className={`text-xs ${message.type === 'success' ? 'text-accent-green-light' : 'text-red-400'}`}>
              {message.text}
            </span>
          )}
        </div>
      </div>

      {canDelete && (
        <div className="mt-5 border-t border-card-border pt-4">
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="rounded-lg border border-accent-red/40 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-accent-red/10 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete competition'}
          </button>
          <p className="mt-2 text-xs text-text-muted">
            Wipes its participants, baselines and standings. A finished competition you want the
            numbers from is better left alone.
          </p>
        </div>
      )}
    </section>
  );
}
