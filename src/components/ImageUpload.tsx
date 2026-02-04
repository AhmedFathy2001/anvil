'use client';

import { useState, useRef } from 'react';

interface Props {
  onImageSelected: (url: string) => void;
  currentUrl?: string;
}

// Detect iOS/iPadOS
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function ImageUpload({ onImageSelected, currentUrl }: Props) {
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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
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
            capture={isIOS() ? 'environment' : undefined}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {uploading ? (
            <p className="text-sm text-text-muted">Uploading...</p>
          ) : (
            <div>
              <p className="text-sm text-text-muted">
                {isIOS() ? 'Tap to take photo or choose from library' : 'Drop image here or click to browse'}
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
          <input
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

      {preview && (
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
