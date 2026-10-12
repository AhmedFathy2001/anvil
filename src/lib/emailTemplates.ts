import { SITE } from '@/lib/site';

// Forge-themed transactional email layout, ported from Anvil.Admin with its email (lib/mailer). One renderer for every customer email so branding stays
// consistent. Email HTML is not web HTML: table-based layout, inline styles only, no external CSS/JS,
// and a plain-text alternative. Colors are hard-coded here (email clients don't read our CSS vars) but
// mirror the "forge" palette used across the marketing pages. Dark by default with a light-mode hint;
// a gradient CTA that degrades to a solid gold button where gradients aren't supported (Outlook).

const C = {
  bg: '#14100b', // page background (warm near-black)
  card: '#1b1611', // email card
  border: '#332a20',
  ink: '#f4ecdd', // headings
  soft: '#c3b39a', // body copy
  faint: '#8a7c66', // small print
  gold: '#e7b24b',
  goldBright: '#ffc964',
  ember: '#ff6a2b',
  btnText: '#1a1006',
} as const;

const FONT = "'Trebuchet MS', 'Segoe UI', Helvetica, Arial, sans-serif";

// Hosted logo (Gmail and most clients strip data: URIs, so the masthead image must be a real URL).
// The Site's app icon (public/icon-192.png); Admin's /logo.png is not served here.
const LOGO_URL = `${SITE.baseUrl}/icon-192.png`;

export interface EmailContent {
  /** Hidden inbox-preview text (shown next to the subject in most clients). */
  preheader: string;
  heading: string;
  /** Body paragraphs. May contain safe inline HTML (e.g. <strong>). */
  lines: string[];
  cta?: { label: string; url: string };
  /** Small print under the CTA (plain text). */
  footnote?: string;
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '');

/** Render a branded email → { html, text }. Pass the result straight to sendMail(). */
export function renderEmail(c: EmailContent): { html: string; text: string } {
  const paragraphs = c.lines
    .map((l) => `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.soft};">${l}</p>`)
    .join('');

  const button = c.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 2px;">
        <tr>
          <td align="center" bgcolor="${C.gold}" style="border-radius:10px;background-image:linear-gradient(100deg,${C.goldBright} 0%,${C.ember} 100%);">
            <a href="${c.cta.url}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;line-height:1;color:${C.btnText};text-decoration:none;border-radius:10px;">
              ${c.cta.label}
            </a>
          </td>
        </tr>
      </table>`
    : '';

  const rawLink = c.cta
    ? `<p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.faint};">
         Button not working? Paste this into your browser:<br>
         <a href="${c.cta.url}" target="_blank" rel="noopener noreferrer" style="color:${C.gold};word-break:break-all;">${c.cta.url}</a>
       </p>`
    : '';

  const foot = c.footnote
    ? `<p style="margin:18px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.faint};">${c.footnote}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>${stripTags(c.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${c.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:100%;background:${C.card};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
          <!-- molten accent bar -->
          <tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:${C.ember};background-image:linear-gradient(100deg,${C.gold} 0%,${C.ember} 100%);">&nbsp;</td></tr>
          <!-- masthead: logo + wordmark (matches the site header) -->
          <tr><td style="padding:26px 32px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:11px;vertical-align:middle;">
                  <img src="${LOGO_URL}" width="34" height="34" alt="" style="display:block;width:34px;height:34px;border-radius:8px;border:0;outline:none;text-decoration:none;">
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:1px;color:${C.ink};">Anvil</span>
                </td>
              </tr>
            </table>
          </td></tr>
          <!-- body -->
          <tr><td style="padding:6px 32px 4px;">
            <h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;font-weight:800;line-height:1.25;color:${C.ink};">${c.heading}</h1>
            ${paragraphs}
            ${button}
            ${foot}
            ${rawLink}
          </td></tr>
          <!-- footer -->
          <tr><td style="padding:26px 32px 30px;">
            <div style="border-top:1px solid ${C.border};padding-top:18px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint};">
              Anvil &mdash; forged for OSRS clans.<br>
              Need a hand? <a href="${SITE.supportDiscord}" target="_blank" rel="noopener noreferrer" style="color:${C.gold};text-decoration:none;">Reach us on Discord</a>.
            </div>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    c.heading,
    '',
    ...c.lines.map(stripTags),
    c.cta ? `\n${c.cta.label}:\n${c.cta.url}` : '',
    c.footnote ? `\n${stripTags(c.footnote)}` : '',
    '\n—',
    'Anvil — forged for OSRS clans.',
    `Need a hand? ${SITE.supportDiscord}`,
  ]
    .filter((l) => l !== '')
    .join('\n');

  return { html, text };
}
