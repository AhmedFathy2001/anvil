// The You tab's head-to-head section (lib/h2h): invitations to answer, and each running challenge
// with both sides' progress. Built only from node kinds the plugin already draws; lives in slot `h2h`
// so Accept / Decline redraw just this card.

import type { H2hView } from '@/lib/h2h';
import { type Node, button, card, col, count, gap, icon, muted, nameText, percent, row, text } from './nodes';

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
    row(text('You', 'white'), undefined, text(`${count(v.me.score)} ${unit}`, v.me.score >= v.them.score && v.me.score > 0 ? 'done' : 'white')),
    { t: 'bar', pct: percent(v.me.score, top), color: 'brand', h: 4, bg: 'panel' },
    gap(3),
    row(nameText(v.them.rsn), undefined, text(`${count(v.them.score)} ${unit}`, 'white')),
    { t: 'bar', pct: percent(v.them.score, top), color: 'progress', h: 4, bg: 'panel' },
  ];
}

export function h2hUi(views: H2hView[], error: string | null = null): Node {
  const parts: Node[] = [row(text('Head-to-head', 'brand'), undefined, text('Open ↗', 'brand', { on: OPEN_SITE, tip: 'Your challenges on Anvil' }), { gap: 0 })];
  if (error) parts.push(gap(4), text(error, 'error', { wrap: true }));
  const open = views.filter((v) => v.status === 'pending' || v.status === 'active');
  if (!open.length) {
    parts.push(gap(6), muted('No challenges running. Challenge a friend from their Anvil profile.', { wrap: true }));
  }
  for (const v of open) {
    const head = v.kind === 'drop' && v.itemIds[0] ? icon({ item: v.itemIds[0], w: 18, h: 18 }) : v.kind === 'kc' && v.statKey ? icon({ boss: v.statKey, w: 16, h: 16 }) : v.statKey ? icon({ skill: v.statKey, w: 16, h: 16 }) : undefined;
    parts.push(gap(8));
    if (v.status === 'pending' && v.side === 'opponent') {
      parts.push(
        col([
          row(head, text(`${v.them.rsn} challenged you`, 'white'), undefined),
          text(v.sentence, 'muted', { wrap: true }),
          muted('Just for bragging rights.', { font: 'small' }),
          { t: 'countdown', at: v.respondBy, prefix: 'Answer within ', due: 'Expired', none: '', font: 'small', color: 'muted' },
          gap(4),
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
      continue;
    }
    if (v.status === 'pending') {
      parts.push(
        col([
          row(head, text(`Waiting on ${v.them.rsn}`, 'muted'), undefined),
          text(v.sentence, 'muted', { wrap: true }),
        ]),
      );
      continue;
    }
    parts.push(
      col([
        row(head, text(v.sentence, 'white', { wrap: true }), undefined),
        ...versus(v),
        { t: 'countdown', at: v.endsAt, prefix: 'Ends in ', due: 'Calling it…', none: '', font: 'small', color: 'muted' },
      ]),
    );
  }
  return { t: 'slot', id: 'h2h', c: card(parts) };
}
