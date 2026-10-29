// /guide — the clan's game guides (raids, bossing, money making…), the same list its /guides page
// shows: its own published guides plus the library ones it hasn't copied (lib/guides publicGuides).
// A guide is long and full of gear blocks and level switches an embed can't hold, so the answer is a
// card — title, summary, cover — linking to the full guide on the site. The `guide` option
// autocompletes over that list and carries the slug. Anvil's own setup guides are /setup.
import { EMBED_COLOR, LIMIT, clamp } from '@/lib/discordEmbeds';
import { fmt } from '@/lib/discordI18n';
import { guideCommand } from '@/lib/discordGuides';
import { GUIDE_CATEGORIES } from '@/lib/guideCategories';
import { absoluteImageUrl } from '@/lib/guideDiscord';
import { publicGuideBySlug, publicGuides } from '@/lib/guides';
import type { ClanCommandCtx, ClanResult } from '@/lib/discordClanCommands';

/** Autocomplete choices for the `guide` option: titles matching what's typed, slug as the value. */
export async function suggestGameGuides(clanId: number, typed: string): Promise<{ name: string; value: string }[]> {
  const q = typed.trim().toLowerCase();
  return (await publicGuides(clanId))
    .map((g) => g.guide)
    .filter((g) => !q || g.title.toLowerCase().includes(q) || g.slug.includes(q))
    .slice(0, 25)
    .map((g) => ({ name: clamp(g.title, 100), value: g.slug.slice(0, 100) }));
}

export async function gameGuideCommand(ctx: ClanCommandCtx): Promise<ClanResult> {
  const { t, clan } = ctx;
  // A Share button posted before /guide became the game guides carries a setup `topic`.
  if (typeof ctx.options.topic === 'string') return guideCommand(ctx);

  const typed = typeof ctx.options.guide === 'string' ? ctx.options.guide.trim() : '';
  // Autocomplete sends the slug; someone who typed a title and hit enter sends the title.
  let found = typed ? await publicGuideBySlug(clan.clanId, typed) : null;
  if (!found && typed) {
    const all = await publicGuides(clan.clanId);
    if (all.length === 0) return { text: t.gameGuide.none };
    const q = typed.toLowerCase();
    found = all.find((g) => g.guide.title.toLowerCase() === q) ?? null;
  }
  if (!found) return { text: t.gameGuide.notFound };

  const { guide } = found;
  const url = clan.origin ? `${clan.origin}/guides/${guide.slug}` : null;
  const category = GUIDE_CATEGORIES.find((c) => c.key === guide.category);
  const updated = Date.parse(guide.updatedAt);
  const body = [guide.summary.trim(), url ? fmt(t.gameGuide.read, { url }) : ''].filter(Boolean).join('\n\n');
  const cover = guide.coverUrl ? absoluteImageUrl(guide.coverUrl, clan.origin) : null;

  return {
    embeds: [
      {
        title: clamp(guide.title, LIMIT.title),
        url: url ?? undefined,
        description: clamp(body, LIMIT.description) || undefined,
        color: EMBED_COLOR.gold,
        fields: [
          { name: t.gameGuide.category, value: category ? `${category.icon} ${category.label}` : guide.category, inline: true },
          ...(Number.isFinite(updated) ? [{ name: t.gameGuide.updated, value: `<t:${Math.floor(updated / 1000)}:R>`, inline: true }] : []),
        ],
        ...(cover ? { image: { url: cover } } : {}),
        footer: { text: clamp(found.origin === 'library' ? `${clan.name} · Anvil guide library` : clan.name, 2048) },
      },
    ],
    shareable: true,
  };
}
