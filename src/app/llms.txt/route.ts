import { ANVIL_DEFINITION, FEATURE_PAGES, GENERAL_FAQ } from '@/lib/answers';
import { absoluteUrl } from '@/lib/seo';

/**
 * /llms.txt — the site described for language models, in the format llmstxt.org proposes: a title,
 * a one-paragraph summary, then links worth reading. Built from lib/answers, so it can never say
 * something the pages don't.
 *
 * Request-time, like robots.txt: the URLs name the apex this deployment answers on.
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const lines = [
    '# Anvil',
    '',
    `> ${ANVIL_DEFINITION}`,
    '',
    'Anvil is also known as "Anvil OSRS". The RuneLite plugin is listed on the RuneLite Plugin Hub as "Anvil".',
    '',
    '## Features',
    ...FEATURE_PAGES.map((p) => `- [${p.h1}](${absoluteUrl(`/features/${p.slug}`)}): ${p.summary}`),
    '',
    '## Guides',
    `- [Plugin setup](${absoluteUrl('/guide/plugin')}): installing the RuneLite plugin and linking an account`,
    `- [Admin guide](${absoluteUrl('/guide/admin')}): setting up a clan and running its first event`,
    `- [Event formats](${absoluteUrl('/guide/formats')}): every format and how it scores`,
    `- [Clan vs clan](${absoluteUrl('/guide/clan-vs-clan')}): hosting a visiting clan`,
    `- [Discord](${absoluteUrl('/guide/discord')}): the bot, channels and slash commands`,
    '',
    '## FAQ',
    ...GENERAL_FAQ.flatMap((f) => [`### ${f.q}`, f.a, '']),
    '## Optional',
    `- [Pricing](${absoluteUrl('/pricing')})`,
    `- [Clan directory](${absoluteUrl('/clans')})`,
    `- [Clan leaderboard](${absoluteUrl('/leaderboard')})`,
  ];
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
