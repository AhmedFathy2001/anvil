// A stored item hunt as the form holds it (components/weekly/HuntFields), for editing one that has
// not started. The reverse of HuntFields.huntPayload.

import type { HuntFormValue } from '@/components/weekly/HuntFields';
import type { HuntConfig } from '@/lib/itemHunt';

export function huntFormFromConfig(config: HuntConfig): HuntFormValue {
  return {
    target: config.target,
    items: config.items.map((it) => ({ id: it.id, name: it.name, known: it.sources, sources: it.sources, anySource: it.sources.length === 0, count: it.count })),
    petGroup: config.petGroup ?? 'all',
    petIds: config.petIds ?? null,
    petKillsShown: config.target === 'pets' ? !!config.killsOf : true,
    rule: config.rule,
    ends: config.ends,
    confirm: config.confirm,
    killsOf: config.target === 'items' ? (config.killsOf ?? '') : '',
    xpSkill: config.xpSkill ?? '',
  };
}
