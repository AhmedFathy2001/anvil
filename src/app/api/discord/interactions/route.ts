import { NextRequest, NextResponse } from 'next/server';
import { timingSafeStrEqual } from '@/lib/auth';
import { getAppPublicKey } from '@/lib/discord-roles';
import { handleCommand } from '@/lib/discordCommands';
import {
  INTERACTION_TYPE,
  pong,
  textReply,
  verifyDiscordSignature,
  type Interaction,
} from '@/lib/discordInteractions';
import { log } from '@/lib/logger';

// Raw body + Node crypto. Never cache: every interaction is a distinct signed request.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The bot's inbound endpoint — where a member's `/bingo …` lands.
 *
 * TWO callers reach this, and they authenticate differently, because Anvil runs in two shapes:
 *
 *   DIRECT (self-host / bring-your-own Discord app). The clan's own application posts here, so the
 *   request carries Discord's Ed25519 signature and we verify it against that application's
 *   verify key. This is the plain path.
 *
 *   FORWARDED (managed clans on the shared Anvil app). One Discord application serves every managed
 *   clan and an application has exactly ONE interactions URL, so Discord posts to the control plane,
 *   which verifies the signature, resolves guild → clan, and forwards the already-verified payload
 *   here over the internal network with the clan's derived secret. We trust that secret exactly as
 *   the cron routes trust theirs.
 *
 * Both paths land in the same handler, so a command behaves identically however the clan is hosted.
 *
 * The endpoint must answer within 3 seconds or Discord shows "the application did not respond", and
 * it must 401 an invalid signature — Discord probes a newly-saved URL with deliberately bad ones and
 * refuses to accept it unless they're rejected.
 */
export async function POST(req: NextRequest) {
  // The RAW bytes: Discord signs the exact body it sent, so re-serializing parsed JSON never verifies.
  const rawBody = await req.text();

  const forwarded = req.headers.get('x-anvil-interaction');
  if (forwarded) {
    const secret = process.env.DISCORD_INTERACTION_SECRET;
    if (!secret || !timingSafeStrEqual(forwarded, secret)) {
      return new NextResponse('invalid signature', { status: 401 });
    }
  } else {
    const publicKey = await getAppPublicKey();
    if (!publicKey) {
      // No bot configured: nothing can be verified, so nothing can be trusted.
      return new NextResponse('invalid signature', { status: 401 });
    }
    const ok = await verifyDiscordSignature({
      publicKeyHex: publicKey,
      signature: req.headers.get('x-signature-ed25519'),
      timestamp: req.headers.get('x-signature-timestamp'),
      rawBody,
    });
    if (!ok) return new NextResponse('invalid signature', { status: 401 });
  }

  let interaction: Interaction;
  try {
    interaction = JSON.parse(rawBody) as Interaction;
  } catch {
    return new NextResponse('bad request', { status: 400 });
  }

  // Discord's liveness check, sent when the URL is first saved and periodically after.
  if (interaction.type === INTERACTION_TYPE.PING) {
    return NextResponse.json(pong());
  }

  if (interaction.type !== INTERACTION_TYPE.APPLICATION_COMMAND) {
    return NextResponse.json(textReply('That interaction type is not supported yet.'));
  }

  try {
    return NextResponse.json(await handleCommand(interaction));
  } catch (e) {
    // A thrown error becomes a Discord timeout, which tells the member nothing at all. Answer in
    // words and keep the detail in the logs.
    log.error('discord interaction failed', {
      command: interaction.data?.name,
      guildId: interaction.guild_id,
      error: (e as Error).message,
    });
    return NextResponse.json(textReply('Anvil hit an error answering that. An admin can check the site logs.'));
  }
}
