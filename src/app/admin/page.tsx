'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username || undefined, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Invalid credentials');
      setLoading(false);
      return;
    }

    const data = await res.json();
    router.push(data.redirectTo || '/admin/dashboard');
  }

  return (
    <div className="max-w-sm mx-auto mt-16 sm:mt-24">
      <div className="border border-card-border rounded-2xl bg-card-bg p-6 sm:p-8 shadow-xl shadow-black/20">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold text-gold">Admin Login</h1>
          <p className="text-text-muted text-sm mt-1">Enter your credentials to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
              placeholder="Username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
              placeholder="Enter password"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold hover:bg-yellow-500 text-brown-dark font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
