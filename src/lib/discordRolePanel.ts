// The self-serve role panel: a pinned message with buttons that hand out roles.
//
// WHY A PANEL AND NOT A JOIN HANDLER. Anvil receives interactions over HTTP and holds no gateway
// connection, so it never sees GUILD_MEMBER_ADD — Discord only emits that down a WebSocket. A
// button, though, is an interaction like any other, so a panel in #roles works on every hosting
// shape including managed clans on the shared bot. Point Discord's own Welcome Screen at the
// channel and a new member lands on it without Anvil needing to know they arrived.
//
// WHAT A CLICK DOES. Assigns the option's roles, and — for an option that asks — opens a modal for
// their RSN and files the claim. The claim is deliberately NOT a verification: it records the name
// and drops it in the moderator queue (lib/rsnClaim). Nothing here asserts an account is owned by
// the person who typed it, because nothing here checked.
//
// The panel's own words are clan-authored, so they live in the config rather than the translation
// dictionaries — the same call as the house rules. Anvil's own replies to a click are translated.

import { db } from '@/db';
import { settings, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getBotCredentials, discordRest } from '@/lib/discord-roles';
import { claimRsnForUser, isPlausibleRsn } from '@/lib/rsnClaim';
import { getDiscordDict, fmt, resolveLocale, type DiscordDict } from '@/lib/discordI18n';
import { EMBED_COLOR, LIMIT, clamp } from '@/lib/discordEmbeds';
import { log } from '@/lib/logger';
import {
  BUTTON_STYLE,
  CALLBACK_TYPE,
  COMPONENT_TYPE,
  MESSAGE_FLAGS,
  invokerId,
  invokerName,
  type Interaction,
  type InteractionResponse,
} from '@/lib/discordInteractions';

const SETTING_KEY = 'discord_role_panel';

/** Discord allows 5 buttons per action row; one row keeps the panel a single readable line. */
export const MAX_OPTIONS = 5;

export interface RolePanelOption {
  /** Stable across edits — it is what the button's custom_id carries. */
  id: string;
  label: string;
  /** Unicode emoji, or blank. Custom guild emoji are not supported. */
  emoji?: string;
  /** One line under the panel text explaining who should press this. */
  description?: string;
  /** Every role granted by this button. More than one is normal ("member" plus a cosmetic). */
  roleIds: string[];
  /** Opens the RSN modal before granting. Only makes sense on the "I play here" option. */
  asksRsn?: boolean;
}

export interface RolePanelConfig {
  enabled: boolean;
  channelId: string;
  /** Set once posted, so a re-post edits the same message instead of littering the channel. */
  messageId: string;
  title: string;
  body: string;
  options: RolePanelOption[];
}

export const EMPTY_PANEL: RolePanelConfig = {
  enabled: false,
  channelId: '',
  messageId: '',
  title: 'Pick your roles',
  body: 'Tell us what you’re here for and we’ll set you up.',
  options: [],
};

export async function readRolePanelConfig(): Promise<RolePanelConfig> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, SETTING_KEY) });
  if (!row?.value) return EMPTY_PANEL;
  try {
    const parsed = JSON.parse(row.value) as Partial<RolePanelConfig>;
    return {
      ...EMPTY_PANEL,
      ...parsed,
      options: (parsed.options ?? []).slice(0, MAX_OPTIONS).map((o) => ({
        id: String(o.id ?? ''),
        label: String(o.label ?? ''),
        emoji: o.emoji || undefined,
        description: o.description || undefined,
        roleIds: Array.isArray(o.roleIds) ? o.roleIds.filter(Boolean).map(String) : [],
        asksRsn: !!o.asksRsn,
      })),
    };
  } catch {
    // A hand-edited settings row must not take the bot down with it.
    return EMPTY_PANEL;
  }
}

export async function writeRolePanelConfig(config: RolePanelConfig): Promise<void> {
  const value = JSON.stringify(config);
  const existing = await db.query.settings.findFirst({ where: eq(settings.key, SETTING_KEY) });
  if (existing) await db.update(settings).set({ value }).where(eq(settings.key, SETTING_KEY));
  else await db.insert(settings).values({ key: SETTING_KEY, value });
}

// ── The panel message ───────────────────────────────────────────────────────────────────────────

const BUTTON_PREFIX = 'rolepanel:';
const MODAL_PREFIX = 'rolepanel-rsn:';
const RSN_FIELD = 'rsn';

export function panelButtonId(optionId: string): string {
  return `${BUTTON_PREFIX}${optionId}`.slice(0, 100);
}

export function parsePanelButtonId(customId: string): string | null {
  return customId.startsWith(BUTTON_PREFIX) ? customId.slice(BUTTON_PREFIX.length) : null;
}

export function parsePanelModalId(customId: string): string | null {
  return customId.startsWith(MODAL_PREFIX) ? customId.slice(MODAL_PREFIX.length) : null;
}

/** The message body Discord is asked to post or edit. */
export function buildPanelMessage(config: RolePanelConfig): {
  embeds: unknown[];
  components: unknown[];
} {
  const lines = [config.body.trim()];
  const described = config.options.filter((o) => o.description?.trim());
  if (described.length) {
    lines.push(
      '',
      ...described.map((o) => `${o.emoji ? `${o.emoji} ` : ''}**${o.label}** — ${o.description!.trim()}`),
    );
  }

  return {
    embeds: [
      {
        title: clamp(config.title, LIMIT.title),
        description: clamp(lines.join('\n'), LIMIT.description),
        color: EMBED_COLOR.gold,
      },
    ],
    components: config.options.length
      ? [
          {
            type: COMPONENT_TYPE.ACTION_ROW,
            components: config.options.map((o) => ({
              type: COMPONENT_TYPE.BUTTON,
              style: BUTTON_STYLE.SECONDARY,
              label: clamp(o.label, 80),
              custom_id: panelButtonId(o.id),
              ...(o.emoji ? { emoji: { name: o.emoji } } : {}),
            })),
          },
        ]
      : [],
  };
}

/**
 * Post the panel, or edit the one already there.
 *
 * Editing rather than re-posting matters more than it looks: the panel is pinned and linked from
 * the welcome screen, and a second copy means half the server presses a stale one.
 */
export async function publishPanel(): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const config = await readRolePanelConfig();
  if (!config.channelId) return { ok: false, reason: 'no-channel' };
  if (!config.options.length) return { ok: false, reason: 'no-options' };

  const creds = await getBotCredentials();
  if (!creds) return { ok: false, reason: 'no-bot' };

  const payload = buildPanelMessage(config);

  if (config.messageId) {
    const edited = await discordRest(
      creds.botToken,
      `/channels/${config.channelId}/messages/${config.messageId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    );
    if (edited.ok) return { ok: true, messageId: config.messageId };
    // 404 = someone deleted it. Fall through and post a fresh one rather than failing forever.
    if (edited.status !== 404) {
      return { ok: false, reason: `edit-${edited.status}` };
    }
  }

  const posted = await discordRest(creds.botToken, `/channels/${config.channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!posted.ok) return { ok: false, reason: `post-${posted.status}` };

  const message = (await posted.json().catch(() => null)) as { id?: string } | null;
  if (!message?.id) return { ok: false, reason: 'post-malformed' };

  await writeRolePanelConfig({ ...config, messageId: message.id });
  return { ok: true, messageId: message.id };
}

// ── Handling a click ────────────────────────────────────────────────────────────────────────────

/** Discord's `users` row for this Discord id, created on first contact exactly as login would. */
async function ensureUser(discordId: string, displayName: string): Promise<number> {
  const existing = await db.query.users.findFirst({ where: eq(users.discordId, discordId) });
  if (existing) return existing.id;
  const inserted = await db
    .insert(users)
    .values({ displayName, discordId, role: 'member' })
    .returning({ id: users.id });
  return inserted[0].id;
}

async function grantRoles(
  botToken: string,
  guildId: string,
  discordUserId: string,
  roleIds: string[],
): Promise<number> {
  let granted = 0;
  for (const roleId of roleIds) {
    const res = await discordRest(
      botToken,
      `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
      { method: 'PUT' },
    );
    if (res.ok) granted++;
    else log.warn('role-panel.grant-failed', { roleId, status: res.status });
  }
  return granted;
}

async function setNickname(
  botToken: string,
  guildId: string,
  discordUserId: string,
  nick: string,
): Promise<boolean> {
  const res = await discordRest(botToken, `/guilds/${guildId}/members/${discordUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ nick: nick.slice(0, 32) }),
  });
  // A 403 here is the ordinary case, not a bug: Discord refuses to let a bot rename anyone whose
  // highest role sits above its own, which includes the server owner. Roles still landed.
  if (!res.ok) log.warn('role-panel.nick-failed', { status: res.status });
  return res.ok;
}

/** The modal asking for an RSN, shown when an option opts into it. */
function rsnModal(t: DiscordDict, optionId: string): InteractionResponse {
  return {
    type: CALLBACK_TYPE.MODAL,
    data: {
      custom_id: `${MODAL_PREFIX}${optionId}`.slice(0, 100),
      title: clamp(t.rolePanel.modalTitle, 45),
      components: [
        {
          type: COMPONENT_TYPE.ACTION_ROW,
          components: [
            {
              type: COMPONENT_TYPE.TEXT_INPUT,
              custom_id: RSN_FIELD,
              style: 1, // short, single line
              label: clamp(t.rolePanel.modalLabel, 45),
              placeholder: clamp(t.rolePanel.modalPlaceholder, 100),
              min_length: 1,
              max_length: 12,
              required: true,
            },
          ],
        },
      ],
    },
  };
}

/** Read a text input out of a modal submission. */
function modalValue(interaction: Interaction, fieldId: string): string {
  const rows = (interaction.data?.components ?? []) as {
    components?: { custom_id?: string; value?: string }[];
  }[];
  for (const row of rows) {
    for (const field of row.components ?? []) {
      if (field.custom_id === fieldId) return (field.value ?? '').trim();
    }
  }
  return '';
}

/** A private confirmation. Never public — nobody else needs to watch someone pick a role. */
function ephemeral(content: string): InteractionResponse {
  return {
    type: CALLBACK_TYPE.CHANNEL_MESSAGE,
    data: { content, flags: MESSAGE_FLAGS.EPHEMERAL },
  };
}

/** Someone pressed a panel button. */
export async function handlePanelButton(
  interaction: Interaction,
  optionId: string,
): Promise<InteractionResponse> {
  const t = await getDiscordDict(resolveLocale(interaction.locale));
  const config = await readRolePanelConfig();
  const option = config.options.find((o) => o.id === optionId);

  // A button from an older version of the panel. Say so rather than silently doing nothing.
  if (!config.enabled || !option) return ephemeral(t.rolePanel.optionGone);

  if (option.asksRsn) return rsnModal(t, option.id);

  const discordUserId = invokerId(interaction);
  const creds = await getBotCredentials();
  if (!discordUserId || !creds) return ephemeral(t.rolePanel.failed);

  const granted = await grantRoles(creds.botToken, creds.guildId, discordUserId, option.roleIds);
  if (granted === 0 && option.roleIds.length > 0) return ephemeral(t.rolePanel.grantFailed);

  return ephemeral(fmt(t.rolePanel.granted, { label: option.label }));
}

/** They filled in the RSN modal. */
export async function handlePanelModal(
  interaction: Interaction,
  optionId: string,
): Promise<InteractionResponse> {
  const t = await getDiscordDict(resolveLocale(interaction.locale));
  const config = await readRolePanelConfig();
  const option = config.options.find((o) => o.id === optionId);
  if (!config.enabled || !option) return ephemeral(t.rolePanel.optionGone);

  const rsn = modalValue(interaction, RSN_FIELD);
  if (!isPlausibleRsn(rsn)) return ephemeral(t.rolePanel.rsnInvalid);

  const discordUserId = invokerId(interaction);
  const creds = await getBotCredentials();
  if (!discordUserId || !creds) return ephemeral(t.rolePanel.failed);

  const userId = await ensureUser(discordUserId, invokerName(interaction));
  const claim = await claimRsnForUser({
    userId,
    rsn,
    note: `Picked "${option.label}" on the Discord role panel`,
    auditEvent: 'role_panel_claim',
  });

  if (!claim.ok) {
    return ephemeral(
      claim.reason === 'owned-by-someone-else'
        ? fmt(t.rolePanel.rsnTaken, { rsn })
        : t.rolePanel.rsnInvalid,
    );
  }

  const granted = await grantRoles(creds.botToken, creds.guildId, discordUserId, option.roleIds);
  const renamed = await setNickname(creds.botToken, creds.guildId, discordUserId, rsn);

  const parts = [fmt(t.rolePanel.granted, { label: option.label })];
  parts.push(fmt(renamed ? t.rolePanel.rsnSavedRenamed : t.rolePanel.rsnSaved, { rsn }));
  parts.push(t.rolePanel.rsnPending);
  if (granted === 0 && option.roleIds.length > 0) parts.push(t.rolePanel.grantFailed);

  return ephemeral(parts.join('\n'));
}
