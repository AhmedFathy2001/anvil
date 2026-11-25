import { headers } from 'next/headers';

/**
 * Chat apps' link unfurlers. They fetch a pasted link once, read its <head> and draw a card; they
 * never sign in. A sign-in-gated page that redirects them hands over the login page's card instead
 * of the event's, so those pages render a plain stub for these agents only.
 *
 * Deliberately NOT search crawlers: they get exactly what a signed-out person gets.
 */
export const LINK_PREVIEW_BOT_RE =
  /Discordbot|Twitterbot|facebookexternalhit|Slackbot|TelegramBot|WhatsApp|LinkedInBot|redditbot|SkypeUriPreview|Embedly|vkShare|bitlybot|Iframely|Mastodon|Cardyb/i;

export function isLinkPreviewAgent(ua: string | null | undefined): boolean {
  return !!ua && LINK_PREVIEW_BOT_RE.test(ua);
}

export async function isLinkPreviewBot(): Promise<boolean> {
  return isLinkPreviewAgent((await headers()).get('user-agent'));
}
