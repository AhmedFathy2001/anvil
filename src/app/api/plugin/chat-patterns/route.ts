import { jsonWithEtag } from '@/lib/httpEtag';
import { pluginOverridePayload } from '@/lib/chatPatterns';

// GET /api/plugin/chat-patterns — the staff-edited replacements for the plugin's built-in chat-line
// regexes (lib/chatPatterns, capability 'chat-patterns').
//
// Public and unauthenticated: the patterns describe Jagex's own chat lines and are the same for
// everyone, and the plugin asks before it has a token. Polled every ~30 minutes per client with
// If-None-Match, so the steady state is a 304 with no body.
export async function GET(request: Request) {
  return jsonWithEtag(request, await pluginOverridePayload());
}
