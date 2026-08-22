import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { listBroadcastTargets } from '@/lib/discord-broadcast';
import {
  MAX_OPTIONS,
  publishPanel,
  readRolePanelConfig,
  writeRolePanelConfig,
  type RolePanelConfig,
  type RolePanelOption,
} from '@/lib/discordRolePanel';

// The self-serve role panel (lib/discordRolePanel).
//
//   GET  → the saved config plus the channels and roles to build the pickers from.
//   PUT  → save the config. Does NOT touch Discord; editing the wording shouldn't repost.
//   POST → publish: post the panel, or edit the one already out there.
//
// Save and publish are separate on purpose. A half-written panel saved mid-edit must not go out to
// the channel, and re-publishing an unchanged panel is a normal thing to want after someone deletes
// the message.

/** Discord snowflakes are all digits. Anything else in a role id is a typo that would silently no-op. */
const SNOWFLAKE = /^\d{5,25}$/;

function sanitizeOption(raw: unknown, index: number): RolePanelOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label.trim().slice(0, 80) : '';
  if (!label) return null;

  const roleIds = Array.isArray(o.roleIds)
    ? o.roleIds.filter((id): id is string => typeof id === 'string' && SNOWFLAKE.test(id))
    : [];

  return {
    // Ids are stable across edits because the buttons already in the channel carry them. A saved
    // option keeps the id it had; a new one gets a fresh one rather than reusing a position.
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim().slice(0, 40) : `opt${index}-${Date.now()}`,
    label,
    emoji: typeof o.emoji === 'string' && o.emoji.trim() ? o.emoji.trim().slice(0, 8) : undefined,
    description:
      typeof o.description === 'string' && o.description.trim()
        ? o.description.trim().slice(0, 200)
        : undefined,
    roleIds,
    asksRsn: !!o.asksRsn,
  };
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [config, targets] = await Promise.all([readRolePanelConfig(), listBroadcastTargets()]);
  return NextResponse.json({ config, ...targets, maxOptions: MAX_OPTIONS });
}

export async function PUT(request: Request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  const current = await readRolePanelConfig();

  const options = Array.isArray(body.options)
    ? body.options.slice(0, MAX_OPTIONS).map(sanitizeOption).filter((o): o is RolePanelOption => o !== null)
    : current.options;

  const channelId =
    typeof body.channelId === 'string' && (body.channelId === '' || SNOWFLAKE.test(body.channelId))
      ? body.channelId
      : current.channelId;

  const next: RolePanelConfig = {
    enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
    channelId,
    // Moving the panel to another channel orphans the old message — forget its id so the next
    // publish posts a fresh one instead of trying to edit a message in a channel we've left.
    messageId: channelId === current.channelId ? current.messageId : '',
    title: typeof body.title === 'string' ? body.title.trim().slice(0, 200) : current.title,
    body: typeof body.body === 'string' ? body.body.trim().slice(0, 3000) : current.body,
    options,
  };

  await writeRolePanelConfig(next);
  return NextResponse.json({ success: true, config: next });
}

export async function POST() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await publishPanel();
  if (!result.ok) {
    const message =
      result.reason === 'no-channel'
        ? 'Pick a channel first.'
        : result.reason === 'no-options'
          ? 'Add at least one button first.'
          : result.reason === 'no-bot'
            ? 'Connect the Discord bot first — the panel is posted by the bot, not a webhook.'
            : `Discord refused the post (${result.reason}). Check the bot can see and post in that channel.`;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const config = await readRolePanelConfig();
  return NextResponse.json({ success: true, messageId: result.messageId, config });
}
