// What a server's admin has set for Anvil's slash commands in Discord itself (Server Settings →
// Integrations → Anvil), in words, for the Commands card on the Discord page.
//
// Discord keeps these per server and lets the bot READ them
// (GET /applications/{app}/guilds/{guild}/commands/permissions); changing them needs each admin's own
// Discord grant, so the site only reflects them. Discord reports only what an admin changed: a
// command left on its defaults has no entry, and reads as nothing here.
//
// Pure: lib/discordCommandPermissionsDb loads the inputs; the tests drive this directly.

/** One override as Discord returns it. type 1 = role, 2 = user, 3 = channel. */
export interface CommandPermission {
  id: string;
  type: number;
  permission: boolean;
}

/** One entry of the response: `id` is a command's id, or the application's own id for "every command". */
export interface CommandPermissionEntry {
  id: string;
  application_id?: string;
  permissions?: CommandPermission[];
}

export interface PermissionNames {
  guildId: string;
  /** Role id → name. */
  roles: Map<string, string>;
  /** Channel id → name. */
  channels: Map<string, string>;
}

/** Discord's id for "every channel" in a server: the server's id minus one. */
export function allChannelsId(guildId: string): string | null {
  try {
    return (BigInt(guildId) - BigInt(1)).toString();
  } catch {
    return null;
  }
}

const list = (names: string[]): string => {
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  const text = shown.length <= 1 ? shown.join('') : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return more > 0 ? `${shown.join(', ')} and ${more} more` : text;
};

/**
 * One set of overrides in words, or null when it changes nothing. "Who" and "where" are separate
 * sentences because Discord applies both: a member needs an allowed role AND an allowed channel.
 */
export function describePermissions(perms: CommandPermission[] | undefined, names: PermissionNames): string | null {
  if (!perms?.length) return null;
  const everyone = names.guildId;
  const everywhere = allChannelsId(names.guildId);
  const role = (id: string) => `@${names.roles.get(id) ?? 'a role'}`;
  const channel = (id: string) => `#${names.channels.get(id) ?? 'a channel'}`;

  const everyoneRule = perms.find((p) => p.type === 1 && p.id === everyone);
  const rolesOn = perms.filter((p) => p.type === 1 && p.id !== everyone && p.permission).map((p) => role(p.id));
  const rolesOff = perms.filter((p) => p.type === 1 && p.id !== everyone && !p.permission).map((p) => role(p.id));
  const usersOn = perms.filter((p) => p.type === 2 && p.permission).length;
  const usersOff = perms.filter((p) => p.type === 2 && !p.permission).length;
  const everywhereRule = perms.find((p) => p.type === 3 && p.id === everywhere);
  const channelsOn = perms.filter((p) => p.type === 3 && p.id !== everywhere && p.permission).map((p) => channel(p.id));
  const channelsOff = perms.filter((p) => p.type === 3 && p.id !== everywhere && !p.permission).map((p) => channel(p.id));
  const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

  const out: string[] = [];
  if (everyoneRule && !everyoneRule.permission) {
    const allowed = [...rolesOn, ...(usersOn ? [people(usersOn)] : [])];
    out.push(allowed.length ? `Only ${list(allowed)} can use it` : 'Hidden from everyone');
  } else {
    const blocked = [...rolesOff, ...(usersOff ? [people(usersOff)] : [])];
    if (blocked.length) out.push(`Off for ${list(blocked)}`);
  }
  if (everywhereRule && !everywhereRule.permission) {
    out.push(channelsOn.length ? `Only in ${list(channelsOn)}` : 'Off in every channel');
  } else if (channelsOff.length) {
    out.push(`Not in ${list(channelsOff)}`);
  }
  return out.length ? `${out.join('. ')}.` : null;
}

export interface DiscordCommandNotes {
  /** Set for every Anvil command at once (the integration's own setting); null = defaults. */
  all: string | null;
  /** Per command name, where that command has its own setting. */
  byCommand: Record<string, string>;
}

/**
 * The whole response in words. `commandIds` maps a registered command's id to its name; an entry
 * whose id is the application's is the integration-wide setting. A command with its own entry is
 * described by that entry alone: in Discord a command's own setting replaces the integration's.
 */
export function describeCommandPermissions(
  entries: CommandPermissionEntry[],
  applicationId: string,
  commandIds: Map<string, string>,
  names: PermissionNames,
): DiscordCommandNotes {
  const out: DiscordCommandNotes = { all: null, byCommand: {} };
  for (const e of entries) {
    const text = describePermissions(e.permissions, names);
    if (!text) continue;
    if (e.id === applicationId) out.all = text;
    else {
      const name = commandIds.get(e.id);
      if (name) out.byCommand[name] = text;
    }
  }
  return out;
}
