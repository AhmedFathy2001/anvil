// Discord roles Anvil assigns automatically must never carry server-administration powers. A
// caller can still use these roles in channel overwrites (the ordinary bingo/team-channel use),
// but cannot turn role sync or a co-host fan-out into Administrator / moderation access.

const bit = (position: number) => BigInt(1) << BigInt(position);

const DANGEROUS_ROLE_PERMISSIONS =
  bit(1) | // Kick Members
  bit(2) | // Ban Members
  bit(3) | // Administrator
  bit(4) | // Manage Channels
  bit(5) | // Manage Server
  bit(7) | // View Audit Log
  bit(13) | // Manage Messages
  bit(17) | // Mention @everyone / @here / all roles
  bit(27) | // Manage Nicknames
  bit(28) | // Manage Roles
  bit(29) | // Manage Webhooks
  bit(32) | // Manage Events
  bit(34) | // Manage Threads
  bit(40); // Moderate Members

export interface AssignableDiscordRole {
  id: string;
  managed?: boolean;
  permissions?: string;
}

export function isSafeAutomatedRole(role: AssignableDiscordRole, guildId: string): boolean {
  if (!role.id || role.id === guildId || role.managed) return false;
  try {
    return (BigInt(role.permissions ?? '0') & DANGEROUS_ROLE_PERMISSIONS) === BigInt(0);
  } catch {
    // An unparseable permission bitfield is not something role automation should guess about.
    return false;
  }
}
