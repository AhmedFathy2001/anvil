// A stored item hunt as the form holds it (components/weekly/HuntFields), for editing one that has
// not started. The reverse of HuntFields.huntPayload.
//
// The form only writes v2, so a v1 hunt opened here comes back as v2 rows: its items as they were,
// a pet hunt as the rows of its pets, each with the "Closest to it" the data picks (a v1 hunt had
// one stat for all of them). Nothing changes until it is saved; a hunt left alone stays v1.

import { encodeStat, huntFormRow, type HuntFormValue } from '@/components/weekly/HuntFields';
import { type HuntConfig, huntRows } from '@/lib/itemHunt';

export function huntFormFromConfig(config: HuntConfig): HuntFormValue {
  const items = huntRows(config).map((it) => {
    if (config.v !== 2) return { ...huntFormRow({ id: it.id, name: it.name, known: it.sources, sources: it.sources, pet: it.pet }), anySource: !it.pet && it.sources.length === 0, count: it.count, points: it.points ?? 1 };
    return {
      id: it.id,
      name: it.name,
      known: it.sources,
      sources: it.sources,
      anySource: !it.pet && it.sources.length === 0,
      count: it.count,
      points: it.points ?? 1,
      pet: !!it.pet,
      stat: encodeStat(it.stat),
      // What was saved is what was chosen: it does not follow the sources any more.
      statAuto: false,
    };
  });
  return {
    items,
    rule: config.rule,
    repeat: config.repeat ?? 'every',
    ends: config.ends,
    confirm: config.confirm,
    prizes: [],
  };
}
