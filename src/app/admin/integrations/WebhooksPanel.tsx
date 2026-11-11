'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { BroadcastChannel } from '@/lib/discord-broadcast';
import WebhookField from '@/components/WebhookField';
import ModeChannelOverrides, { modeChannelForField } from '@/components/ModeChannelOverrides';
import PlainSetting from '@/components/PlainSetting';
import ToggleSetting from '@/components/ToggleSetting';
import Input from '@/components/Input';
import GuideLink from '@/components/GuideLink';
import {
  WEBHOOK_GROUPS,
  WEBHOOK_SECTIONS,
  groupLabel,
  searchFields,
  searchTokens,
  type SettingField,
  type WebhookGroupId,
} from '@/lib/webhookFields';
import { creatorHidesSettingKey } from '@/lib/creatorSpaces';
import { useRevealTarget } from '@/components/HashReveal';

interface Props {
  channels: BroadcastChannel[];
  botEnabled: boolean;
  /** Offer each game mode's own channel under the plugin fields (not in a creator space). */
  modes?: boolean;
}

// One field, rendered by the component its kind calls for. The catalogue carries the words; this
// only decides which control they go into.
function Field({ field, channels, botEnabled, modes }: { field: SettingField } & Props) {
  if (field.kind === 'webhook') {
    return (
      <div className="space-y-3">
        <WebhookField
          settingKey={field.key}
          label={field.label}
          helpText={field.help}
          channels={channels}
          botEnabled={botEnabled}
        />
        {/* Secondary: the game modes' own channel for the same kind (Admin → Discord → Game modes). */}
        {modes && modeChannelForField(field.key) && <ModeChannelOverrides settingKey={field.key} />}
      </div>
    );
  }
  if (field.kind === 'plain') {
    return (
      <PlainSetting
        settingKey={field.key}
        label={field.label}
        placeholder={field.placeholder}
        helpText={field.help}
      />
    );
  }
  return <ToggleSetting settingKey={field.key} label={field.label} helpText={field.help} defaultOn={field.defaultOn} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="border border-card-border rounded-xl p-5 bg-card-bg space-y-6">{children}</section>;
}

// Fields inside a card are separated rather than merely stacked — several of them are three-part
// controls (picker, create, paste) and without a rule it reads as one enormous form.
function Stack({ fields, channels, botEnabled, modes }: { fields: readonly SettingField[] } & Props) {
  return (
    <>
      {fields.map((f, i) => (
        <div key={f.key} className={i > 0 ? 'border-t border-card-border pt-4' : undefined}>
          <Field field={f} channels={channels} botEnabled={botEnabled} modes={modes} />
        </div>
      ))}
    </>
  );
}

/**
 * The Discord destinations, split into tabs and searchable.
 *
 * This page grew to twenty-odd fields on one scroll — sixteen of them webhook boxes that look
 * identical — and finding the one you came for meant reading every label on the way past. Tabs cut
 * it into the three questions actually being asked (what does Anvil post, what does the plugin
 * post, and about whom), and the search cuts across all three for the case where you know the word
 * but not which of them it lives under.
 */
export default function WebhooksPanel({ channels, botEnabled, creator = false }: Props & { creator?: boolean }) {
  const [group, setGroup] = useState<WebhookGroupId>('site');
  const [query, setQuery] = useState('');

  // #setting-<key> (the settings search, a link from elsewhere): open the tab that field sits on.
  useRevealTarget((id) => {
    const key = /^setting-(.+)$/.exec(id)?.[1];
    const section = key ? WEBHOOK_SECTIONS.find((s) => s.fields.some((f) => f.key === key)) : undefined;
    if (!section) return;
    setGroup(section.group);
    setQuery('');
  });

  // A creator space: everybody who plays is a guest of it, so "who gets announced" (members vs
  // guests) has no answer there — switching "only your own members" on would silence every player.
  const groups = WEBHOOK_GROUPS.filter((g) => !creator || g.id !== 'filters');
  const searching = searchTokens(query).length > 0;
  // …and no weeklies, calendar, roster, coffer, co-hosts or Leagues to give a channel (lib/creatorSpaces).
  const matches = useMemo(
    () =>
      searchFields(query).filter(
        (m) => !creator || (m.section.group !== 'filters' && !creatorHidesSettingKey(m.field.key)),
      ),
    [query, creator],
  );

  const visible = WEBHOOK_SECTIONS.filter((s) => s.group === group)
    .map((s) => (creator ? { ...s, fields: s.fields.filter((f) => !creatorHidesSettingKey(f.key)) } : s))
    .filter((s) => s.fields.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          {groups.map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={!searching && group === g.id}
              onClick={() => {
                setGroup(g.id);
                setQuery('');
              }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-lg border transition-colors',
                !searching && group === g.id
                  ? 'border-gold/60 bg-gold/10 text-gold'
                  : 'border-card-border text-text-muted hover:text-foreground',
              )}
            >
              {creator && g.id === 'site' ? 'Event posts' : g.label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto flex items-center gap-3">
          <GuideLink href="/guide/discord">Setting up Discord</GuideLink>
        </div>
        <div className="sm:w-64">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels…"
            aria-label="Search Discord channels and settings"
          />
        </div>
      </div>

      {searching ? (
        matches.length === 0 ? (
          <Card>
            <p className="text-sm text-text-muted">
              Nothing matches “{query.trim()}”. Try a kind of post — drops, deaths, pets, quests, coffer, leagues — or
              a settings key like <code className="text-xs">webhook_rare_drops</code>.
            </p>
          </Card>
        ) : (
          <>
            <p className="text-xs text-text-muted">
              {matches.length} {matches.length === 1 ? 'setting' : 'settings'} across all tabs. Pick a tab to clear the
              search.
            </p>
            <Card>
              {matches.map(({ section, field }, i) => (
                <div key={field.key} className={i > 0 ? 'border-t border-card-border pt-4' : undefined}>
                  <p className="text-[11px] uppercase tracking-wide text-text-muted mb-2">
                    {groupLabel(section.group)} · {section.title}
                  </p>
                  <Field field={field} channels={channels} botEnabled={botEnabled} modes={!creator} />
                </div>
              ))}
            </Card>
          </>
        )
      ) : (
        visible.map((section) => (
          <Card key={section.id}>
            <div>
              <p className="text-sm font-medium mb-1">{section.title}</p>
              <p className="text-xs text-text-muted">{section.blurb}</p>
            </div>
            <Stack fields={section.fields} channels={channels} botEnabled={botEnabled} modes={!creator} />
          </Card>
        ))
      )}
    </div>
  );
}
