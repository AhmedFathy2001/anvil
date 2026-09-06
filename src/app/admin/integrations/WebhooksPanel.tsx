'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { BroadcastChannel } from '@/lib/discord-broadcast';
import WebhookField from '@/components/WebhookField';
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

interface Props {
  channels: BroadcastChannel[];
  botEnabled: boolean;
}

// One field, rendered by the component its kind calls for. The catalogue carries the words; this
// only decides which control they go into.
function Field({ field, channels, botEnabled }: { field: SettingField } & Props) {
  if (field.kind === 'webhook') {
    return (
      <WebhookField
        settingKey={field.key}
        label={field.label}
        helpText={field.help}
        channels={channels}
        botEnabled={botEnabled}
      />
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
  return <ToggleSetting settingKey={field.key} label={field.label} helpText={field.help} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="border border-card-border rounded-xl p-5 bg-card-bg space-y-6">{children}</section>;
}

// Fields inside a card are separated rather than merely stacked — several of them are three-part
// controls (picker, create, paste) and without a rule it reads as one enormous form.
function Stack({ fields, channels, botEnabled }: { fields: readonly SettingField[] } & Props) {
  return (
    <>
      {fields.map((f, i) => (
        <div key={f.key} className={i > 0 ? 'border-t border-card-border pt-4' : undefined}>
          <Field field={f} channels={channels} botEnabled={botEnabled} />
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
export default function WebhooksPanel({ channels, botEnabled }: Props) {
  const [group, setGroup] = useState<WebhookGroupId>('site');
  const [query, setQuery] = useState('');

  const searching = searchTokens(query).length > 0;
  const matches = useMemo(() => searchFields(query), [query]);

  const visible = WEBHOOK_SECTIONS.filter((s) => s.group === group);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          {WEBHOOK_GROUPS.map((g) => (
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
              {g.label}
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
                  <Field field={field} channels={channels} botEnabled={botEnabled} />
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
            <Stack fields={section.fields} channels={channels} botEnabled={botEnabled} />
          </Card>
        ))
      )}
    </div>
  );
}
