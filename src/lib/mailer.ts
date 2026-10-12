import nodemailer, { type Transporter } from 'nodemailer';
import { AwsClient } from 'aws4fetch';
import { log } from '@/lib/logger';

// Outgoing email. The same two transports, and the same env names, as Anvil.Admin's lib/email —
// so the box's existing SES credentials switch it on as they are:
//
//   1. Amazon SES HTTPS API (port 443, never firewalled — preferred):
//        SES_REGION (or AWS_REGION), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, MAIL_FROM
//        optional SES_CONFIGURATION_SET, which makes every send traceable in SES.
//   2. SMTP, any provider: SMTP_HOST, SMTP_PORT (587 STARTTLS / 465 TLS), SMTP_USER, SMTP_PASS, MAIL_FROM
//        Hetzner blocks port 25 outright and some hosts block more, which is why the API wins.
//
// Neither configured, email is simply off: isMailConfigured() is false and sendMail() returns false
// without trying, so every caller treats email as one more channel that may or may not be there.
// The SES call is signed with aws4fetch (already here for R2) rather than the AWS SDK.

function sesRegion(): string | undefined {
  return process.env.SES_REGION?.trim() || process.env.AWS_REGION?.trim() || undefined;
}
function sesConfigured(): boolean {
  return !!(sesRegion() && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.MAIL_FROM?.trim());
}
function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM?.trim());
}

export function isMailConfigured(): boolean {
  return sesConfigured() || smtpConfigured();
}

let ses: AwsClient | null = null;
function sesClient(): AwsClient {
  ses ??= new AwsClient({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: sesRegion(),
    service: 'ses',
  });
  return ses;
}

let smtp: Transporter | null = null;
function smtpClient(): Transporter {
  if (smtp) return smtp;
  const port = Number(process.env.SMTP_PORT || 587);
  smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Fail fast rather than hang a cron run when the port is blocked.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  return smtp;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Send one email. True when SES / the SMTP server accepted it; never throws. */
export async function sendMail(mail: MailInput): Promise<boolean> {
  const from = process.env.MAIL_FROM?.trim();
  try {
    if (sesConfigured()) {
      const configSet = process.env.SES_CONFIGURATION_SET?.trim();
      const res = await sesClient().fetch(`https://email.${sesRegion()}.amazonaws.com/v2/email/outbound-emails`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          FromEmailAddress: from,
          Destination: { ToAddresses: [mail.to] },
          ...(configSet ? { ConfigurationSetName: configSet } : {}),
          Content: {
            Simple: {
              Subject: { Data: mail.subject, Charset: 'UTF-8' },
              Body: { Html: { Data: mail.html, Charset: 'UTF-8' }, Text: { Data: mail.text, Charset: 'UTF-8' } },
            },
          },
        }),
      });
      if (!res.ok) {
        log.warn('mail.send-failed', { transport: 'ses', status: res.status, body: (await res.text()).slice(0, 300) });
        return false;
      }
      return true;
    }
    if (smtpConfigured()) {
      await smtpClient().sendMail({ from, ...mail });
      return true;
    }
    return false;
  } catch (e) {
    log.warn('mail.send-failed', { error: (e as Error).message });
    return false;
  }
}

/** Escape text for an HTML email body. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
