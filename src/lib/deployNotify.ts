// "The site was deployed" — posted by the site, about itself.
//
// This used to belong to the control plane, and had to: a deploy meant recreating one container per
// clan, so the only thing that knew a deploy had happened AND how each clan fared was the thing
// doing the recreating. There is one deployment now. The rollout it reported on does not exist, the
// control plane that owned it does not exist, and the CI step that called it has been posting to a
// 404 on every push since the migration — quietly failing the job and telling nobody why.
//
// So the site says it itself. It is the only thing that can: the webhook is clan configuration, it
// lives in this app's env, and CI has no business holding a Discord URL it would have to be handed
// through a repo secret. What CI knows — the version, the notes, the channel — it passes in.

/** Discord rejects content over 2000 characters; leave headroom for the framing around the notes. */
const MAX_CONTENT = 1900;

/**
 * Best-effort webhook post. Never throws.
 *
 * A deleted webhook, a Discord outage, a typo in the env — none of those are reasons to fail a
 * deploy that has already succeeded. The caller reports whether it landed; nothing depends on it.
 */
export async function postDiscordWebhook(url: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, MAX_CONTENT) }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Trim patch notes to what is left of the budget once the surrounding message is accounted for. */
function trimNotes(notes: string | undefined, budget: number): string {
  const n = (notes ?? '').trim();
  if (!n) return '';
  if (n.length <= budget) return n;
  return n.slice(0, Math.max(0, budget - 1)).trimEnd() + '…';
}

export interface DeployNotice {
  /** `git describe` output — "v1.0.0", or "v1.0.0-12-gabc1234" past a tag. */
  version?: string;
  /** Commit subjects in the push, already formatted as a list by CI. */
  notes?: string;
  /** 'beta' reads as a canary; anything else is the ordinary deploy. */
  channel?: string;
  /** The commit actually serving, so a reader can tell a redeploy from a new build. */
  sha?: string;
}

/**
 * The message.
 *
 * Deliberately one line plus notes rather than the old fleet summary — there is no "8/9 healthy" to
 * report when there is one of everything. What replaced that information is the SHA: the deploy is
 * health-gated on the site answering with this exact commit, so seeing it here means the new build
 * is the one serving, not merely the one that was pushed.
 */
export function deployMessage(notice: DeployNotice): string {
  const beta = notice.channel === 'beta';
  const head = beta ? '🧪 **anvil-site** — beta build deployed' : '🚀 **anvil-site** — deployed';
  const ver = notice.version ? ` \`${notice.version}\`` : '';
  const sha = notice.sha ? ` (\`${notice.sha.slice(0, 7)}\`)` : '';
  const headline = `${head}${ver}${sha}`;
  const notes = trimNotes(notice.notes, MAX_CONTENT - headline.length - 24);
  return notes ? `${headline}\n\n**What's new:**\n${notes}` : headline;
}

/**
 * Post it, if there is anywhere to post it to.
 *
 * Returns what happened rather than throwing, so the endpoint can answer "deployed, but the webhook
 * is unset" distinctly from "deployed and announced" — the first is a configuration note, not a
 * failure, and a deploy that succeeded must not report as failed because nobody is listening.
 */
export async function announceDeploy(notice: DeployNotice): Promise<'posted' | 'unconfigured' | 'failed'> {
  const url = process.env.DEPLOY_DISCORD_WEBHOOK?.trim();
  if (!url) return 'unconfigured';
  return (await postDiscordWebhook(url, deployMessage(notice))) ? 'posted' : 'failed';
}
