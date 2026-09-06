// /guide — the setup guides, in Discord. The whole guide is a web page (rich figures, notes, nested
// callouts) that an embed can't reproduce, so this does PARTIAL rendering + a link: the overview
// lists the guide's steps, and `/guide topic:plugin step:5` shows that one step's text with a deep
// link straight to it on the site. Both in the reader's language — the CONTENT comes from the guide
// i18n dictionary (already 15 languages), and only the small chrome here lives in the Discord dict.
//
// A "step" is a numbered SECTION of a guide (its `<Section id n>` on the page). The order and the
// anchor ids live on the page components; GUIDE_OUTLINES mirrors that order so a step number resolves
// to the same section a reader would scroll to, and the deep link uses the same #anchor.

import { EMBED_COLOR, LIMIT, clamp, statField } from '@/lib/discordEmbeds';
import { fmt } from '@/lib/discordI18n';
import { getDict, guideHref, type GuidePage } from '@/app/guide/_i18n';
import type { ClanCommandCtx, ClanResult } from '@/lib/discordClanCommands';

interface GuideOutline {
  /** Top-level key in the guide dictionary (getDict()[ns]). */
  ns: string;
  /** The web page slug, for guideHref. */
  page: GuidePage;
  /** Section anchor ids IN PAGE ORDER — mirrors each page's own <Section> list. Step n = sections[n-1]. */
  sections: string[];
}

// Mirrors src/app/guide/_pages/*Guide.tsx section order. The choice values in the command def are
// exactly these keys.
export const GUIDE_OUTLINES: Record<string, GuideOutline> = {
  plugin: { ns: 'plugin', page: 'plugin', sections: ['install', 'connect', 'accounts', 'working', 'bingo', 'notifications', 'clips', 'trouble'] },
  discord: { ns: 'discord', page: 'discord', sections: ['bot', 'connect', 'channels', 'roles', 'commands', 'posts', 'quiet'] },
  board: { ns: 'board', page: 'board', sections: ['kinds', 'pick', 'bulk', 'traps', 'points', 'reveal', 'check'] },
  clan: { ns: 'clan', page: 'clan', sections: ['before', 'create', 'live', 'setup', 'members', 'first', 'together'] },
  fees: { ns: 'fees', page: 'fees', sections: ['set', 'collect', 'sign', 'pay', 'disputes'] },
  formats: { ns: 'formats', page: 'formats', sections: ['shape', 'reveal', 'scoring', 'missions', 'choose'] },
  captain: { ns: 'captain', page: 'captain', sections: ['before', 'warroom', 'draft', 'roster', 'during'] },
  admin: { ns: 'admin', page: 'admin', sections: ['access', 'setup', 'channels', 'roster', 'board', 'tiles', 'teams', 'launch', 'after'] },
  moderator: { ns: 'moderator', page: 'moderator', sections: ['what', 'queue', 'submissions', 'verify', 'roster', 'startshot', 'judgement'] },
  clanvsclan: { ns: 'clanVsClan', page: 'clan-vs-clan', sections: ['shape', 'team', 'staff', 'link', 'captains', 'player', 'dead'] },
};

export const GUIDE_TOPICS = Object.keys(GUIDE_OUTLINES);

const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const asStringArray = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;

/**
 * Turn one guide-copy string into something Discord renders sensibly: fill the placeholders we can
 * (the site URL and clan name), make the guide's relative links absolute so they're clickable, and
 * leave the rest of the inline markup (**bold**, _italic_, `code`) — Discord speaks it already.
 */
function renderCopy(raw: string, origin: string | null, clanName: string): string {
  let out = raw
    .replaceAll('{origin}', origin ?? '')
    .replaceAll('{apex}', origin ?? '')
    .replaceAll('{clanName}', clanName);
  // [text](/relative) → [text](https://origin/relative); a relative href doesn't link in Discord.
  if (origin) out = out.replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, `[$1](${origin}$2)`);
  // A remaining relative link with no origin: keep the words, drop the dead href.
  out = out.replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, '$1');
  return out;
}

/** The visible text of one section: its `body` paragraphs, or its `intro`, whichever it has. */
function sectionBody(section: Record<string, unknown>, origin: string | null, clanName: string): string {
  const body = asStringArray(section.body);
  const text = body ? body.join('\n\n') : (asString(section.intro) ?? '');
  return text ? renderCopy(text, origin, clanName) : '';
}

/** Absolute URL to a guide page (or one of its steps), in the reader's language. Null without an origin. */
function guideUrl(origin: string | null, locale: string, page: GuidePage, anchor?: string): string | null {
  if (!origin) return null;
  return `${origin}${guideHref(locale, page)}${anchor ? `#${anchor}` : ''}`;
}

/** The one clan-command handler for /guide. */
export async function guideCommand(ctx: ClanCommandCtx): Promise<ClanResult> {
  const { t, clan } = ctx;
  const topic = typeof ctx.options.topic === 'string' ? ctx.options.topic : '';
  const outline = GUIDE_OUTLINES[topic];
  if (!outline) return { text: t.guide.notFound };

  // The guide dictionary shares the Discord locale codes, so the resolved code maps straight across;
  // getDict fills anything untranslated from English.
  const dict = (await getDict(ctx.locale)) as unknown as Record<string, Record<string, unknown>>;
  const g = dict[outline.ns] ?? {};
  const guideTitle = asString(g.title) ?? topic;
  const total = outline.sections.length;

  const stepOpt = ctx.options.step;
  const stepNum = typeof stepOpt === 'number' ? stepOpt : typeof stepOpt === 'string' ? parseInt(stepOpt, 10) : NaN;
  const wantsStep = Number.isFinite(stepNum);

  // ── A specific step ──────────────────────────────────────────────────────────────────────────
  if (wantsStep) {
    if (stepNum < 1 || stepNum > total) {
      return { text: fmt(t.guide.noSuchStep, { total }) };
    }
    const id = outline.sections[stepNum - 1];
    const section = (g[id] as Record<string, unknown>) ?? {};
    const sectionTitle = asString(section.title) ?? id;
    const url = guideUrl(clan.origin, ctx.locale, outline.page, id);

    const body: string[] = [];
    const copy = sectionBody(section, clan.origin, clan.name);
    if (copy) body.push(copy);
    if (url) body.push('', fmt(t.guide.openStep, { url }));
    body.push('', `-# ${clamp(guideTitle, 80)}`);

    return {
      embeds: [
        {
          title: clamp(`📖 ${fmt(t.guide.stepTitle, { n: stepNum, total, title: sectionTitle })}`, LIMIT.title),
          url: url ?? undefined,
          description: clamp(body.join('\n'), LIMIT.description),
          color: EMBED_COLOR.blue,
          author: { name: clamp(clan.name, LIMIT.author), url: clan.origin ?? undefined },
        },
      ],
      shareable: true,
    };
  }

  // ── The overview: the dek, then every step by number ───────────────────────────────────────────
  const url = guideUrl(clan.origin, ctx.locale, outline.page);
  const body: string[] = [];
  const dek = asString(g.dek);
  if (dek) body.push(renderCopy(dek, clan.origin, clan.name));
  body.push(
    '',
    t.guide.stepsHeading,
    ...outline.sections.map((id, i) => {
      const title = asString((g[id] as Record<string, unknown> | undefined)?.title) ?? id;
      return `**${i + 1}.** ${clamp(title, 80)}`;
    }),
  );
  if (url) body.push('', fmt(t.guide.readFull, { url }));
  body.push('', fmt(t.guide.jumpHint, { topic }));

  return {
    embeds: [
      {
        title: clamp(`📖 ${guideTitle}`, LIMIT.title),
        url: url ?? undefined,
        description: clamp(body.join('\n'), LIMIT.description),
        color: EMBED_COLOR.gold,
        author: { name: clamp(clan.name, LIMIT.author), url: clan.origin ?? undefined },
        fields: [statField(t.guide.stepsField, total)],
      },
    ],
    shareable: true,
  };
}
