'use client';

import { useState, useEffect } from 'react';

export function useCountdown(targetDate: string | null | undefined) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!targetDate) {
      setCountdown('');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const target = new Date(targetDate);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${mins}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${mins}m ${secs}s`);
      } else {
        setCountdown(`${mins}m ${secs}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return countdown;
}

export function useRefreshCountdown() {
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!nextRefresh) {
      setCountdown('');
      return;
    }
    const interval = setInterval(() => {
      const now = new Date();
      const diff = nextRefresh.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown('');
        setNextRefresh(null);
      } else {
        const min = Math.floor(diff / 60000);
        const sec = Math.floor((diff % 60000) / 1000);
        setCountdown(`${min}:${sec.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [nextRefresh]);

  return { countdown, nextRefresh, setNextRefresh };
}
