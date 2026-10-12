import nodemailer, { type Transporter } from 'nodemailer';
import { log } from '@/lib/logger';

// Outgoing email, over plain SMTP so any provider works (Amazon SES, Brevo, Resend, Postmark, a
// mailbox's own SMTP). Two env vars switch it on:
//
//   SMTP_URL   smtps://USER:PASS@smtp.example.com:465   (or smtp://…:587, which upgrades with STARTTLS)
//   MAIL_FROM  "Anvil <no-reply@anvilosrs.com>"
//
// Unset, email is simply off: isMailConfigured() is false and sendMail() returns false without
// trying, so every caller treats email as one more channel that may or may not be there.

let transport: Transporter | null = null;

export function isMailConfigured(): boolean {
  return !!process.env.SMTP_URL?.trim() && !!process.env.MAIL_FROM?.trim();
}

function getTransport(): Transporter {
  transport ??= nodemailer.createTransport(process.env.SMTP_URL!.trim());
  return transport;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send one email. True when the SMTP server accepted it; never throws. */
export async function sendMail(input: MailInput): Promise<boolean> {
  if (!isMailConfigured()) return false;
  try {
    await getTransport().sendMail({ from: process.env.MAIL_FROM!.trim(), ...input });
    return true;
  } catch (e) {
    log.warn('mail.send-failed', { error: (e as Error).message });
    return false;
  }
}

/** Escape text for an HTML email body. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
