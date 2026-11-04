import { PLATFORM_LABEL, type Platform } from '@/lib/connectedAccountsRules';
import type { LiveLink } from '@/lib/connectedAccounts';

const TONE: Record<Platform, string> = {
  twitch: 'text-[#a970ff]',
  youtube: 'text-[#ff4e45]',
  kick: 'text-[#53fc18]',
  medal: 'text-[#ffb800]',
};

/**
 * A person's connected accounts on their profile (lib/connectedAccounts): one chip per platform, a ✓
 * for a verified link, "not verified" spelled out for one that is not (nothing for a plain pasted link like Medal), and LIVE when the platform says
 * they are streaming now. The caller has already applied who may see what (visibleLinks).
 *
 * Every URL was built by lib/connectedAccountsRules from a sanitized id on the platform's own host,
 * and opens with rel="noopener noreferrer nofollow" — nothing typed by the person is ever an href.
 */
export default function ConnectedAccounts({ links, className = '' }: { links: LiveLink[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Connected accounts">
      {links.map((l) => {
        const body = (
          <>
            <span className={`font-medium ${TONE[l.platform]}`}>{PLATFORM_LABEL[l.platform]}</span>
            <span className="max-w-[18ch] truncate text-foreground">{l.handle}</span>
            {l.verified ? (
              <span className="text-accent-green-light" title="Verified: they proved this account is theirs" aria-label="verified">
                ✓
              </span>
            ) : l.selfReported ? null : (
              <span className="rounded-full border border-yellow-500/30 px-1.5 text-[10px] text-yellow-400">not verified</span>
            )}
            {l.live && (
              <span className="rounded bg-accent-red px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white">
                Live
              </span>
            )}
          </>
        );
        const cls = 'flex items-center gap-1.5 rounded-full border border-card-border bg-card-bg px-3 py-1 text-[12.5px]';
        return (
          <li key={l.platform}>
            {l.url ? (
              // An external profile link built from a sanitized id — never a clan path.
              <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className={`${cls} transition-colors hover:border-gold/40`}>
                {body}
              </a>
            ) : (
              <span className={cls}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
