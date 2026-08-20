'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { clanUrl } from '@/lib/clanFetch';

export default function PlayerDirectLoginPage() {
  const params = useParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const playerToken = params.playerToken as string;
    if (!playerToken) {
      router.push(clanUrl('/player'));
      return;
    }

    async function login() {
      const res = await fetch('/api/player/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerToken }),
      });

      if (res.ok) {
        router.push(clanUrl('/player/dashboard'));
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid token');
        setTimeout(() => router.push(clanUrl('/player')), 2000);
      }
    }

    login();
  }, [params.playerToken, router]);

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <p className="text-red-400 mb-2">{error}</p>
        <p className="text-text-muted text-sm">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto text-center py-12">
      <p className="text-text-muted">Logging in...</p>
    </div>
  );
}
