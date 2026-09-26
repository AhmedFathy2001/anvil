import type { Metadata } from 'next';

import ClanLink from '@/components/ClanLink';
import { verifyUser } from '@/lib/auth';
import { listMine } from '@/lib/guideProposals';

export const metadata: Metadata = { title: 'My guide proposals' };

const TONE: Record<string, string> = {
  pending: 'bg-amber-900/40 text-amber-200',
  approved: 'bg-emerald-900/40 text-emerald-300',
  rejected: 'bg-red-900/40 text-red-300',
  withdrawn: 'bg-white/10 text-text-muted',
};

export default async function MyProposalsPage() {
  const user = await verifyUser();
  const rows = user ? await listMine(user.userId) : [];
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <ClanLink href="/guides" className="text-xs text-text-muted hover:text-gold">
            ← Guides
          </ClanLink>
          <h1 className="mt-1 text-2xl font-bold text-gold">My guide proposals</h1>
          <p className="mt-1 text-sm text-text-muted">Guides and edits you sent to the Anvil library, and what the guide team said.</p>
        </div>
        <ClanLink href="/guides/propose" className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light">
          Write a guide
        </ClanLink>
      </div>
      {!user ? (
        <p className="text-sm text-text-muted">Sign in to see your proposals.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-card-border p-8 text-center text-sm text-text-muted">
          Nothing yet. Know a boss better than the guide does? Suggest an edit from any library guide, or write your own.
        </p>
      ) : (
        <ul className="divide-y divide-card-border rounded-xl border border-card-border bg-card-bg">
          {rows.map((p) => (
            <li key={p.id}>
              <ClanLink href={`/guides/proposals/${p.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {p.targetGuideId ? 'Edit: ' : ''}
                    {p.title}
                  </div>
                  {p.reviewNote && <p className="mt-0.5 text-xs text-text-muted">“{p.reviewNote}”</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] capitalize ${TONE[p.status] ?? ''}`}>{p.status}</span>
                <span className="shrink-0 text-xs text-text-muted">{p.updatedAt.slice(0, 10)}</span>
              </ClanLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
