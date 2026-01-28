'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlayerLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setError('');
    setLoading(true);

    const res = await fetch('/api/player/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerToken: token.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Invalid token');
      setLoading(false);
      return;
    }

    router.push('/player/dashboard');
  }

  return (
    <div className="max-w-sm mx-auto mt-16 sm:mt-24">
      <div className="border border-card-border rounded-2xl bg-card-bg p-6 sm:p-8 shadow-xl shadow-black/20">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🎮</div>
          <h1 className="text-2xl font-bold text-gold">Player Login</h1>
          <p className="text-text-muted text-sm mt-1">Enter your player token to access your dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Player Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              autoFocus
              className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 font-mono text-sm"
              placeholder="Paste your token here..."
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full bg-gold hover:bg-yellow-500 text-brown-dark font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
