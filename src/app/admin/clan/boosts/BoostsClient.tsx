'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useDialog } from '@/components/Confirm';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';
import { clanFetch } from '@/lib/clanFetch';

const card = 'mb-6 rounded-xl border border-card-border bg-card-bg p-5';
const primary =
  'rounded-lg border border-gold/50 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold-light hover:bg-gold/25 disabled:opacity-50';
const quiet = 'rounded-lg border border-card-border px-4 py-2 text-sm text-text-muted hover:text-foreground disabled:opacity-50';

async function send(method: 'PUT' | 'POST', body: unknown): Promise<{ ok: boolean; data: { error?: string; note?: string | null } }> {
  const res = await clanFetch('/api/admin/clan/boosts', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as { error?: string; note?: string | null } };
}

/** The recruiting line (Level 2) and the monthly Anvil Discord post (Level 3). */
export default function BoostsClient({
  recruitingLine,
  lineUnlocked,
  lineMax,
  postUnlocked,
  postMax,
  postNextAt,
  lastPostAt,
}: {
  recruitingLine: string;
  lineUnlocked: boolean;
  lineMax: number;
  postUnlocked: boolean;
  postMax: number;
  /** This month's post is used: when the next opens. */
  postNextAt: string | null;
  lastPostAt: string | null;
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [line, setLine] = useState(recruitingLine);
  const [post, setPost] = useState('');
  const [busy, setBusy] = useState(false);
  const [lineMsg, setLineMsg] = useState<string | null>(null);
  const [postMsg, setPostMsg] = useState<string | null>(null);

  async function saveLine(value: string) {
    setBusy(true);
    setLineMsg(null);
    const r = await send('PUT', { recruitingLine: value });
    setBusy(false);
    if (!r.ok) return setLineMsg(r.data.error ?? 'Could not save.');
    setLine(value);
    setLineMsg(value.trim() ? 'Saved.' : 'Cleared.');
    router.refresh();
  }

  async function sendPost() {
    const ok = await confirm({
      title: 'Post to the Anvil Discord?',
      body: 'It goes out once, now, as your clan’s post for this month. You can’t edit or send another until next month.',
      confirmLabel: 'Post it',
    });
    if (!ok) return;
    setBusy(true);
    setPostMsg(null);
    const r = await send('POST', { post });
    setBusy(false);
    if (!r.ok) return setPostMsg(r.data.error ?? 'Could not post.');
    setPost('');
    setPostMsg(r.data.note ?? 'Posted. See you next month.');
    router.refresh();
  }

  return (
    <>
      <section id="boost-recruiting-line" className={`scroll-mt-24 ${card}`}>
        <h2 className="mb-1 font-semibold">Recruiting line</h2>
        <p className="mb-3 text-sm text-text-muted">
          {lineUnlocked
            ? 'One sentence for visitors, on your clan page and your Clan Hall card. Shown to people who aren’t in the clan.'
            : 'Unlocks at Level 2: one sentence for visitors on your clan page and Clan Hall card.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={line}
            onChange={(e) => setLine(e.target.value.slice(0, lineMax))}
            maxLength={lineMax}
            placeholder="e.g. Weekend raids, chill skilling, all timezones welcome"
            aria-label="Recruiting line"
            disabled={!lineUnlocked || busy}
            className="min-w-0 flex-[1_1_18rem] rounded-lg px-3 py-2 text-sm"
          />
          {lineUnlocked && (
            <button type="button" disabled={busy || !line.trim()} onClick={() => void saveLine(line)} className={primary}>
              Save
            </button>
          )}
          {recruitingLine && (
            <button type="button" disabled={busy} onClick={() => void saveLine('')} className={quiet}>
              Clear
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-text-dim">
          {line.length}/{lineMax}
          {lineMsg && <span className="ml-3 text-text-muted">{lineMsg}</span>}
        </p>
      </section>

      <section id="boost-recruitment-post" className={`scroll-mt-24 ${card}`}>
        <h2 className="mb-1 font-semibold">Recruitment post in the Anvil Discord</h2>
        <p className="mb-3 text-sm text-text-muted">
          {!postUnlocked
            ? 'Unlocks at Level 3: once a month, a recruitment post from your clan in Anvil’s own Discord, written by you.'
            : postNextAt
              ? `This month’s post went out${lastPostAt ? ` on ${lastPostAt}` : ''}. The next one opens on ${postNextAt}.`
              : 'Once a calendar month, written by you and posted once when you send it, with a link to your clan page. Mentions are removed and nobody is pinged.'}
        </p>
        {postUnlocked && !postNextAt && (
          <>
            <Textarea
              value={post}
              onChange={(e) => setPost(e.target.value.slice(0, postMax))}
              maxLength={postMax}
              rows={5}
              placeholder="Who you are, what you do, who you’re looking for."
              aria-label="Recruitment post"
              disabled={busy}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" disabled={busy || post.trim().length < 20} onClick={() => void sendPost()} className={primary}>
                Post to the Anvil Discord
              </button>
              <span className="text-xs text-text-dim">
                {post.length}/{postMax}
              </span>
            </div>
          </>
        )}
        {postMsg && <p className="mt-2 text-sm text-text-muted">{postMsg}</p>}
      </section>
    </>
  );
}
