'use client';

import { useEffect, useState } from 'react';
import Select, { type SelectOption } from '@/components/Select';
import Input from '@/components/Input';
import { loadGuildRoles, type GuildRole } from '@/lib/rolesClient';

interface RoleSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  noneLabel?: string; // label for the "no role" option
  allowNone?: boolean;
  ariaLabel?: string;
  className?: string;
}

// Pick a Discord role from a dropdown of the guild's roles instead of pasting a role ID. Falls back
// to a manual ID field when the bot isn't connected (no roles to list), so nothing breaks off-bot.
export default function RoleSelect({
  value,
  onChange,
  placeholder = 'Select a role…',
  noneLabel = 'None',
  allowNone = true,
  ariaLabel,
  className,
}: RoleSelectProps) {
  const [roles, setRoles] = useState<GuildRole[] | null>(null);

  useEffect(() => {
    loadGuildRoles()
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  if (roles === null) return <div className="text-text-muted text-sm">Loading roles…</div>;

  // No roles to list (bot not connected) — keep manual ID entry working.
  if (roles.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Role ID (connect the bot to pick from a list)"
        className={`w-full px-3 py-2 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60 ${className ?? ''}`}
      />
    );
  }

  const options: SelectOption[] = [
    ...(allowNone ? [{ value: '', label: noneLabel }] : []),
    ...roles.map((r) => ({
      value: r.id,
      label: `@${r.name}`,
      dot: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : undefined,
    })),
  ];

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      className={className}
    />
  );
}
