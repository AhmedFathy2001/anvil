'use client';

import { useEffect } from 'react';

import FoldSection from '@/components/FoldSection';
import PlainSetting from '@/components/PlainSetting';
import ToggleSetting from '@/components/ToggleSetting';
import TierBandsSetting from '@/components/TierBandsSetting';
import BalanceRatesSetting from '@/components/BalanceRatesSetting';

export default function RulesSettings() {
  // Links from elsewhere (#fees from an event's sign-ups, #scoring from the balance panel) should land
  // on that section open, not on a page of folded lines.
  useEffect(() => {
    const el = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (el instanceof HTMLDetailsElement) {
      el.open = true;
      el.scrollIntoView();
    }
  }, []);

  return (
    <div className="space-y-3.5">
      <FoldSection id="house-rules" sprite="clue" title="House rules" summary="Your clan’s rules in your words, shown by /bingo rules and the rules post.">
        <p className="text-sm text-text-muted">
          How each board scores is read off the event itself, so this is only the prose: screenshots, plugin use, what counts
          as cheating.
        </p>
        <PlainSetting
          settingKey="board_rules"
          label="House rules"
          multiline
          rows={12}
          markdownPreview
          placeholder={'Keep a screenshot of every drop.\nRun the plugin if you can.\nDon\'t cheat. It\'s for fun.'}
          helpText="Markdown works: **bold**, *italic*, bullets, numbers, links. The same as Discord, so it reads right in both. Long rules are trimmed to fit a post, so put the essentials first and link the rest below."
        />
        <PlainSetting
          settingKey="board_rules_url"
          label="Full rules link"
          placeholder="https://…"
          helpText="Where the complete rules live. Shown under the house rules in Discord."
        />
      </FoldSection>

      <FoldSection id="fees" sprite="coins" title="Fee sign-off" summary="How many staff must confirm a paid entry fee before it counts as settled.">
        <PlainSetting
          settingKey="fee_confirmations_required"
          label="Confirmations needed to settle a fee"
          placeholder="1"
          helpText="1 = one other staff member confirms (the collector can never confirm their own). 2 or more = several sign-offs. 0 = marking a fee paid settles it straight away. Use 0 if you're the only one handling money."
        />
        <ToggleSetting
          settingKey="fee_autoconfirm_on_event_end"
          label="Settle collected fees when an event ends"
          helpText="When an event ends, fees a staff member already marked paid are settled without waiting for a second sign-off. Unpaid fees are never touched."
        />
      </FoldSection>

      <FoldSection id="scoring" sprite="stats" title="Difficulty & balance" summary="The difficulty tiers and the effort model behind the board balance check.">
        <div>
          <p className="font-medium">Difficulty tiers</p>
          <p className="text-sm text-text-muted mt-0.5 mb-3">The bands points map onto, used by the Tier filter on boards.</p>
          <TierBandsSetting />
        </div>
        <div className="border-t border-[#2a221b] pt-5">
          <p className="font-medium">Balance rates</p>
          <p className="text-sm text-text-muted mt-0.5 mb-3">Kill times, XP rates and skill floors behind each board&apos;s effort estimate.</p>
          <BalanceRatesSetting />
        </div>
      </FoldSection>

      <FoldSection id="feeds" sprite="casket" title="Lately feed & luck" summary="What the clan’s Lately feed keeps, and which drops count on the Luck boards.">
        <PlainSetting
          settingKey="moments_clan_min_loot_gp"
          label="Keep drops worth at least (gp)"
          placeholder="5000000"
          helpText="Genuinely rare drops are kept whatever they're worth; this is the bar for everything else. Blank = 5,000,000."
        />
        <PlainSetting
          settingKey="moments_clan_min_ca_tier"
          label="Keep combat tasks from tier"
          placeholder="Master"
          helpText="Easy, Medium, Hard, Elite, Master or Grandmaster. Blank = Master. Type 'none' to leave them out."
        />
        <ToggleSetting
          settingKey="moments_clan_deaths"
          label="Keep deaths too"
          helpText="Off by default. A death is part of an event's story; a clan-wide feed of everyone dying is not."
        />
        <PlainSetting
          settingKey="moments_min_loot_gp"
          label="During an event, keep hauls worth at least (gp)"
          placeholder="1000000"
          helpText="An event's own, lower bar. Blank = 1,000,000."
        />
        <PlainSetting
          settingKey="luck_value_floor"
          label="Luck boards count tradeable drops worth at least (gp)"
          placeholder="1000000"
          helpText="Pets and jars always count. Blank = 1,000,000. Set 0 to judge on rarity alone."
        />
      </FoldSection>
    </div>
  );
}
