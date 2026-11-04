import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { requireSecret } from '@/lib/env';
import { chatBotChannels, joinReplyForBroadcaster } from '@/lib/twitchBot/channels';
import { botSecret, isTwitchUserId, type BotChannelsAnswer, type BotJoinAnswer } from '@/lib/twitchBot/wire';

const SECRET = Buffer.from(botSecret(requireSecret('PLAYER_SESSION_SECRET', 'dev-player-secret')));

// The Twitch chat bot's reads (bot/twitchChat.ts). Not for browsers: it answers only to the bot's
// derived secret and 404s anything else, so the route doesn't advertise itself.
//
//   GET ?op=channels                      → { channels: [{ broadcasterId }] }
//   GET ?op=join&broadcaster=<twitch id>  → { reply }  (null = stay quiet)
export async function GET(request: Request) {
  const given = Buffer.from(request.headers.get('x-bot-secret') ?? '');
  if (given.length !== SECRET.length || !crypto.timingSafeEqual(given, SECRET)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const url = new URL(request.url);
  const headers = { 'Cache-Control': 'no-store' };
  if (url.searchParams.get('op') === 'channels') {
    const body: BotChannelsAnswer = { channels: (await chatBotChannels()).map((c) => ({ broadcasterId: c.broadcaster.id })) };
    return NextResponse.json(body, { headers });
  }
  if (url.searchParams.get('op') === 'join') {
    const b = url.searchParams.get('broadcaster');
    if (!isTwitchUserId(b)) return NextResponse.json({ error: 'Bad broadcaster' }, { status: 400 });
    const body: BotJoinAnswer = { reply: await joinReplyForBroadcaster(b) };
    return NextResponse.json(body, { headers });
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
