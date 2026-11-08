/**
 * Webhook tokens never reach a log. A webhook URL is `…/api/webhooks/<id>/<token>`, and errors from
 * fetch or the database can echo it back, so anything logged around a webhook call goes through
 * here: only the error's name, a code, and its message with every webhook token cut out. Pure.
 */

const WEBHOOK_PATH = /(\/api\/(?:v\d+\/)?webhooks\/)(\d+)\/[\w-]+/gi;

/** Every `/api/webhooks/<id>/<token>` in `text`, with the token replaced. The id is public; it stays. */
export function redactWebhooks(text: string): string {
  return text.replace(WEBHOOK_PATH, (_m, prefix: string, id: string) => `${prefix}${id}/[redacted]`);
}

/** A loggable view of an error: name, code, redacted message — never the raw object. */
export function safeError(error: unknown): { name: string; code?: string; message: string } {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { name: error.name, ...(typeof code === 'string' || typeof code === 'number' ? { code: String(code) } : {}), message: redactWebhooks(error.message).slice(0, 300) };
  }
  return { name: 'Error', message: redactWebhooks(String(error)).slice(0, 300) };
}

/** A webhook URL's public id (the number before the token), or null. */
export function webhookIdOf(url: string): string | null {
  const m = /\/api\/(?:v\d+\/)?webhooks\/(\d+)\//i.exec(url);
  return m ? m[1] : null;
}
