'use client';

import { useRef, useState } from 'react';

import Input from '@/components/Input';
import Textarea from '@/components/Textarea';
import Select from '@/components/Select';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';
import { GUIDE_CATEGORIES, GUIDE_LIMITS } from '@/lib/guideCategories';
import { renderGuide } from '@/lib/guideMarkdown';
import DiscordPreview from './DiscordPreview';

// The writing half of a guide — fields, the markdown toolbar, image upload, and the two previews —
// shared by the clan/library editor and the proposal form, so a proposer writes in exactly the
// editor that will later publish their words.

export interface GuideFieldValues {
  title: string;
  summary: string;
  category: string;
  coverUrl: string | null;
  body: string;
}

/** Toolbar actions: wrap the selection, or prefix every selected line. */
type Tool =
  | { label: string; title: string; wrap: [string, string]; placeholder: string }
  | { label: string; title: string; prefix: string | ((i: number) => string) }
  | { label: string; title: string; insert: string };

const TOOLS: Tool[] = [
  { label: 'B', title: 'Bold', wrap: ['**', '**'], placeholder: 'bold' },
  { label: 'I', title: 'Italic', wrap: ['*', '*'], placeholder: 'italic' },
  { label: 'U', title: 'Underline', wrap: ['__', '__'], placeholder: 'underline' },
  { label: 'S', title: 'Strikethrough', wrap: ['~~', '~~'], placeholder: 'struck' },
  { label: '▮▮', title: 'Spoiler', wrap: ['||', '||'], placeholder: 'spoiler' },
  { label: '</>', title: 'Inline code', wrap: ['`', '`'], placeholder: 'code' },
  { label: 'H1', title: 'Big heading', prefix: '# ' },
  { label: 'H2', title: 'Heading', prefix: '## ' },
  { label: 'H3', title: 'Small heading', prefix: '### ' },
  { label: '-#', title: 'Subtext (small grey line)', prefix: '-# ' },
  { label: '•', title: 'Bulleted list', prefix: '- ' },
  { label: '1.', title: 'Numbered list', prefix: (i) => `${i + 1}. ` },
  { label: '❝', title: 'Quote', prefix: '> ' },
  { label: '🔗', title: 'Link', wrap: ['[', '](https://)'], placeholder: 'link text' },
  { label: '```', title: 'Code block', wrap: ['```\n', '\n```'], placeholder: 'code' },
  { label: '⎯ msg', title: 'Start a new Discord message here', insert: '\n---\n' },
];

/** Upload one image to `uploadUrl`; resolves to its public URL, or null (having said why). */
export function useGuideUpload(uploadUrl: string) {
  const { notify } = useDialog();
  const [uploading, setUploading] = useState(false);
  async function upload(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await clanFetch(uploadUrl, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(j.error ?? 'Upload failed', 'error');
        return null;
      }
      return j.url as string;
    } finally {
      setUploading(false);
    }
  }
  return { upload, uploading };
}

export function GuideFieldsEditor({
  value,
  onChange,
  readOnly = false,
  uploadUrl,
}: {
  value: GuideFieldValues;
  onChange: (patch: Partial<GuideFieldValues>) => void;
  readOnly?: boolean;
  uploadUrl: string;
}) {
  const { upload, uploading } = useGuideUpload(uploadUrl);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  function applyTool(tool: Tool) {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: a, selectionEnd: b, value: text } = ta;
    let next = text;
    let caretA = a;
    let caretB = b;
    if ('wrap' in tool) {
      const inner = text.slice(a, b) || tool.placeholder;
      next = text.slice(0, a) + tool.wrap[0] + inner + tool.wrap[1] + text.slice(b);
      caretA = a + tool.wrap[0].length;
      caretB = caretA + inner.length;
    } else if ('prefix' in tool) {
      const lineStart = text.lastIndexOf('\n', a - 1) + 1;
      const lineEnd = text.indexOf('\n', b) === -1 ? text.length : text.indexOf('\n', b);
      const block = text.slice(lineStart, lineEnd).split('\n');
      const out = block.map((l, i) => (typeof tool.prefix === 'function' ? tool.prefix(i) : tool.prefix) + l).join('\n');
      next = text.slice(0, lineStart) + out + text.slice(lineEnd);
      caretA = lineStart;
      caretB = lineStart + out.length;
    } else {
      next = text.slice(0, a) + tool.insert + text.slice(b);
      caretA = caretB = a + tool.insert.length;
    }
    onChange({ body: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caretA, caretB);
    });
  }

  function insertAtCaret(snippet: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: a, selectionEnd: b, value: text } = ta;
    // Images must sit on a line of their own to be images.
    const before = a > 0 && text[a - 1] !== '\n' ? '\n' : '';
    const after = text[b] !== '\n' ? '\n' : '';
    const ins = `${before}${snippet}${after}`;
    onChange({ body: text.slice(0, a) + ins + text.slice(b) });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(a + ins.length, a + ins.length);
    });
  }

  async function uploadImages(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const url = await upload(f);
      if (url) insertAtCaret(`![${f.name.replace(/\.[a-z0-9]+$/i, '')}](${url})`);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">Title</span>
          <Input value={value.title} maxLength={GUIDE_LIMITS.title} disabled={readOnly} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">Category</span>
          <Select
            value={value.category}
            disabled={readOnly}
            onChange={(v) => onChange({ category: v })}
            options={GUIDE_CATEGORIES.map((c) => ({ value: c.key, label: `${c.icon} ${c.label}` }))}
            ariaLabel="Category"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 flex justify-between text-xs text-text-muted">
          <span>Summary — one line under the title</span>
          <span>
            {value.summary.length}/{GUIDE_LIMITS.summary}
          </span>
        </span>
        <Input value={value.summary} maxLength={GUIDE_LIMITS.summary} disabled={readOnly} onChange={(e) => onChange({ summary: e.target.value })} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">Cover image (optional — shown at the top, in Discord too)</span>
          <Input
            value={value.coverUrl ?? ''}
            placeholder="https://… or upload"
            disabled={readOnly}
            onChange={(e) => onChange({ coverUrl: e.target.value || null })}
          />
        </label>
        {!readOnly && (
          <div className="flex items-end">
            <input
              ref={coverRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) {
                  const url = await upload(f);
                  if (url) onChange({ coverUrl: url });
                }
              }}
            />
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              className="h-[38px] rounded border border-card-border px-3 text-sm text-text-muted hover:text-foreground"
            >
              Upload
            </button>
          </div>
        )}
      </div>

      <div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-1 rounded-t border border-b-0 border-card-border bg-black/20 p-1.5">
            {TOOLS.map((t) => (
              <button
                key={t.title}
                type="button"
                title={t.title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTool(t)}
                className={`min-w-[30px] rounded px-1.5 py-1 text-xs text-text-muted hover:bg-white/10 hover:text-foreground ${
                  t.label === 'B' ? 'font-bold' : t.label === 'I' ? 'italic' : t.label === 'U' ? 'underline' : t.label === 'S' ? 'line-through' : ''
                }`}
              >
                {t.label}
              </button>
            ))}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files) void uploadImages(files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="ml-auto rounded bg-gold/15 px-2 py-1 text-xs text-gold hover:bg-gold/25 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : '🖼 Image'}
            </button>
          </div>
        )}
        <Textarea
          ref={bodyRef}
          value={value.body}
          readOnly={readOnly}
          onChange={(e) => onChange({ body: e.target.value })}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
            if (files.length && !readOnly) {
              e.preventDefault();
              void uploadImages(files);
            }
          }}
          onDrop={(e) => {
            const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
            if (files.length && !readOnly) {
              e.preventDefault();
              void uploadImages(files);
            }
          }}
          rows={26}
          spellCheck
          placeholder={'## Gear\n- Item one\n- Item two\n\n![Setup](https://…)\n\n---\n\n## The fight\n…'}
          className={`min-h-[420px] font-mono text-[13px] leading-relaxed ${readOnly ? '' : 'rounded-t-none'}`}
        />
        <p className="mt-1 text-[11px] text-text-muted">
          Discord markdown: <code>#</code>/<code>##</code>/<code>###</code> headings, <code>-#</code> subtext, <code>- lists</code>,{' '}
          <code>&gt; quotes</code>, <code>||spoilers||</code>, <code>[links](https://…)</code>. An image on its own line shows under the
          text above it. A line with only <code>---</code> starts a new message. Paste or drop screenshots straight in.
        </p>
      </div>
    </div>
  );
}

/** Discord / Site preview tabs for a guide being written. */
export function GuidePreviewPane({
  value,
  origin,
  siteUrl,
  updatedAt,
  byline,
}: {
  value: GuideFieldValues;
  origin: string | null;
  siteUrl: string | null;
  updatedAt: string | null;
  byline: string | null;
}) {
  const [preview, setPreview] = useState<'discord' | 'site'>('discord');
  return (
    <div className="min-w-0">
      <div className="mb-2 flex gap-1">
        {(['discord', 'site'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreview(p)}
            className={`rounded-lg px-3 py-1 text-xs ${preview === p ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-foreground'}`}
          >
            {p === 'discord' ? 'Discord' : 'Site'}
          </button>
        ))}
      </div>
      <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
        {preview === 'discord' ? (
          <DiscordPreview
            guide={{ title: value.title, summary: value.summary, body: value.body, coverUrl: value.coverUrl, siteUrl, updatedAt, byline }}
            origin={origin}
          />
        ) : (
          <article className="rounded-xl border border-card-border bg-card-bg p-5">
            {value.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value.coverUrl} alt="" className="mb-4 max-h-64 w-full rounded-lg object-cover" />
            )}
            <h1 className="text-2xl font-bold text-gold">{value.title}</h1>
            {value.summary && <p className="mt-1 text-sm text-text-muted">{value.summary}</p>}
            <div className="mt-3 text-[15px] text-gray-200">{renderGuide(value.body, { showBreaks: true })}</div>
          </article>
        )}
      </div>
    </div>
  );
}
