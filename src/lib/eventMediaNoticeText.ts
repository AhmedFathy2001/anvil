// What the reminder before an event's proof images are deleted SAYS (lib/eventMediaNotice sends it).
// Pure, no `@/` import, so the wording is tested directly. Fixed text on purpose: the only things
// that vary are the event's name (admin-typed, so cleaned), the date, a count and our own link.

export interface PurgeNoticeInput {
  stage: 'first' | 'final';
  eventName: string;
  clanName: string;
  purgeAt: Date;
  /** Proof images that will be deleted. */
  files: number;
  /** The event's admin page on the clan's site, where the archive download is. */
  archiveUrl: string;
  now: Date;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Whole days from `now` to `at`, never below 1 — "in 0 days" helps nobody. */
export function daysUntil(at: Date, now: Date): number {
  return Math.max(1, Math.ceil((at.getTime() - now.getTime()) / 86_400_000));
}

/** An admin-typed name made safe for a DM or an email subject: one line, no links or mentions. */
export function cleanName(name: string, max = 80): string {
  const s = name
    .replace(/https?:\/\/\S+|www\.\S+|discord(?:app)?\.(?:gg|com)\/\S*/gi, '')
    .replace(/@(everyone|here)/gi, '$1')
    .replace(/<[@#&!:a-z0-9_]+>/gi, '')
    .replace(/[*_~`|>\[\]()\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (s.length > max ? `${s.slice(0, max - 1)}…` : s) || 'your event';
}

export function purgeNoticeText(input: PurgeNoticeInput): { subject: string; lines: string[] } {
  const event = cleanName(input.eventName);
  const days = daysUntil(input.purgeAt, input.now);
  const when = `${fmtDate(input.purgeAt)} (${days} day${days === 1 ? '' : 's'})`;
  const images = `${input.files} proof image${input.files === 1 ? '' : 's'}`;
  const subject =
    input.stage === 'final'
      ? `Last reminder: ${event} proof images are deleted in ${days} day${days === 1 ? '' : 's'}`
      : `${event}: download the archive before the proof images are deleted`;
  const lines = [
    `The ${images} from ${event} (${cleanName(input.clanName, 60)}) will be deleted on ${when}.`,
    'Anvil keeps proof images for 90 days after an event ends. The event itself, its results, completions and who did what are kept for good.',
    'To keep the images, download the event archive: one zip with every record and every proof, filed by tile and team.',
  ];
  return { subject, lines };
}
