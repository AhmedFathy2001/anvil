// The You tab's head-to-head section (lib/h2h): invitations to answer, and each running challenge
// with both sides' progress. Built only from node kinds the plugin already draws; lives in slot `h2h`
// so Accept / Decline redraw just this card.

import type { H2hView } from '@/lib/h2h';
import { type Node, button, col, count, icon, muted, nameText, percent, row, text } from './nodes';
import { GOLD, clock, goldCard, section, small, title } from './sections';

const OPEN_SITE = { a: 'site', path: '/challenges' } as const;

function versus(v: H2hView): Node[] {
  if (v.kind === 'drop') {
    const me = v.me.hitAt ? 'Got it' : 'Not yet';
    const them = v.them.hitAt ? 'Got it' : 'Not yet';
    return [
      row(text('You', 'white'), undefined, text(me, v.me.hitAt ? 'done' : 'muted')),
      row(nameText(v.them.rsn), undefined, text(them, v.them.hitAt ? 'done' : 'muted')),
    ];
  }
  const top = Math.max(1, v.me.score, v.them.score);
  const unit = v.kind === 'kc' ? 'kc' : 'xp';
  return [
    row(text(`You ${count(v.me.score)} ${unit}`, GOLD), undefined, muted(`${v.them.rsn} ${count(v.them.score)} ${unit}`)),
    { t: 'bar', pct: percent(v.me.score, top), color: 'brand', h: 4, bg: 'panel' },
    { t: 'bar', pct: percent(v.them.score, top), color: 'progress', h: 4, bg: 'panel' },
  ];
}

export function h2hUi(views: H2hView[], error: string | null = null): Node {
  const open = views.filter((v) => v.status === 'pending' || v.status === 'active');
  // An invitation to answer is the tab's one gold card: it expires. The rest sit in a plain card.
  const invites = open.filter((v) => v.status === 'pending' && v.side === 'opponent');
  const rest = open.filter((v) => !invites.includes(v));
  const cards: Node[] = invites.map((v) =>
    goldCard(`${v.them.rsn} challenged you`, [
      row(headIcon(v), text(v.sentence, 'white', { wrap: true }), undefined),
      muted('Just for bragging rights.', { font: 'small' }),
      { t: 'countdown', at: v.respondBy, prefix: 'Answer within ', due: 'Expired', none: '', font: 'small', color: 'muted' },
      {
        t: 'grid',
        cols: 2,
        gap: 6,
        c: [
          button('Decline', { a: 'post', act: 'h2h-decline', args: { id: String(v.id) }, into: 'h2h' }),
          button('Accept', { a: 'post', act: 'h2h-accept', args: { id: String(v.id) }, into: 'h2h' }),
        ],
      },
    ]),
  );
  if (rest.length || !invites.length || error) {
    const parts: Node[] = [row(undefined, title('Head-to-head'), small('Open ↗', GOLD, { on: OPEN_SITE, tip: 'Your challenges on Anvil' }), { gap: 0 })];
    if (error) parts.push(text(error, 'error', { wrap: true }));
    if (!open.length) parts.push(muted('No challenges running. Challenge a friend from their Anvil profile.', { wrap: true }));
    for (const v of rest) {
      if (v.status === 'pending') {
        parts.push(col([row(headIcon(v), text(`Waiting on ${v.them.rsn}`, 'muted'), undefined), muted(v.sentence, { wrap: true })], { gap: 2 }));
        continue;
      }
      parts.push(col([
        row(headIcon(v), text(v.sentence, 'white', { wrap: true }), undefined),
        ...versus(v),
        clock(v.endsAt, 'Ends in ', 'Calling it…', Date.now()),
      ], { gap: 3 }));
    }
    cards.push(section(parts));
  }
  return { t: 'slot', id: 'h2h', c: col(cards, { gap: 6 }) };
}

function headIcon(v: H2hView): Node | undefined {
  return v.kind === 'drop' && v.itemIds[0] ? icon({ item: v.itemIds[0], w: 18, h: 18 }) : v.kind === 'kc' && v.statKey ? icon({ boss: v.statKey, w: 16, h: 16 }) : v.statKey ? icon({ skill: v.statKey, w: 16, h: 16 }) : undefined;
}
