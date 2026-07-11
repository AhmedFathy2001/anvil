'use client';

import { useState, useRef } from 'react';
import Input from '@/components/Input';

interface Props {
  onImageSelected: (url: string) => void;
  currentUrl?: string;
  // Bulk mode: accept several files at once and report all uploaded URLs together (used for drop
  // evidence, so you can attach every screenshot in one go instead of one slot at a time).
  multiple?: boolean;
  onImagesSelected?: (urls: string[]) => void;
}

// Detect iOS/iPadOS
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function ImageUpload({ onImageSelected, currentUrl, multiple, onImagesSelected }: Props) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setPreview(url);
        onImageSelected(url);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Upload failed. Try a different image format.');
      }
    } catch {
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setUploading(false);
      // Reset file input so the same file can be selected again
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }

  // Bulk upload: send each file through the single-file endpoint in turn, then report every URL
  // that came back so the caller can fill all its slots at once.
  async function handleFiles(files: File[]) {
    setUploading(true);
    setError(null);
    const urls: string[] = [];
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const { url } = await res.json();
          urls.push(url);
        }
      }
      if (urls.length === 0) setError('Upload failed. Try different image files.');
      else onImagesSelected?.(urls);
    } catch {
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    if (multiple) handleFiles(Array.from(files));
    else handleFile(files[0]);
  }

  function handleUrlSubmit() {
    if (urlInput.trim()) {
      setPreview(urlInput.trim());
      onImageSelected(urlInput.trim());
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            mode === 'upload'
              ? 'bg-gold/20 border-gold text-gold'
              : 'border-card-border text-text-muted hover:border-gold/50'
          }`}
        >
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            mode === 'url'
              ? 'bg-gold/20 border-gold text-gold'
              : 'border-card-border text-text-muted hover:border-gold/50'
          }`}
        >
          Paste URL
        </button>
      </div>

      {mode === 'upload' ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-gold bg-gold/10'
              : 'border-card-border hover:border-gold/50'
          }`}
        >
          {/* Multiple inputs for better iOS compatibility */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple={multiple}
            capture={multiple ? undefined : isIOS() ? 'environment' : undefined}
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (!files || files.length === 0) return;
              if (multiple) handleFiles(Array.from(files));
              else handleFile(files[0]);
            }}
          />
          {uploading ? (
            <p className="text-sm text-text-muted">Uploading...</p>
          ) : (
            <div>
              <p className="text-sm text-text-muted">
                {multiple
                  ? 'Select several screenshots at once'
                  : isIOS()
                    ? 'Tap to take photo or choose from library'
                    : 'Drop image here or click to browse'}
              </p>
              <p className="text-xs text-text-muted mt-1 opacity-70">
                Supports JPG, PNG, GIF, WebP
              </p>
            </div>
          )}
          {error && (
            <p className="text-xs text-red-400 mt-2">{error}</p>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://..."
            className="flex-1 px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="px-3 py-2 text-xs font-medium bg-gold/10 text-gold border border-gold/20 rounded hover:bg-gold/20 transition-colors"
          >
            Set
          </button>
        </div>
      )}

      {!multiple && preview && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-32 object-cover rounded border border-card-border"
          />
          <button
            type="button"
            onClick={() => { setPreview(null); onImageSelected(''); }}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-400"
          >
            x
          </button>
        </div>
      )}
    </div>
  );
}
