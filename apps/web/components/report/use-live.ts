'use client';

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { fetchJson } from '@/lib/http';
import { FEED_SIZE, RecentPayload, SummaryPayload } from '@/lib/live-schemas';

const POLL_MS = 5000;

const poll = { staleTime: POLL_MS, refetchInterval: POLL_MS } as const;

// no-store: the api sends max-age=15, which would otherwise hide two of every three polls
const NO_STORE: RequestInit = { cache: 'no-store' };

export const useLiveSummary = (initialData: SummaryPayload): SummaryPayload =>
  useQuery({
    queryKey: ['live', 'summary'],
    queryFn: () => fetchJson('/api/v1/summary', SummaryPayload, NO_STORE),
    initialData,
    ...poll,
  }).data;

export const useRecentFailures = (initialData: RecentPayload): RecentPayload =>
  useQuery({
    queryKey: ['live', 'recent'],
    queryFn: () => fetchJson(`/api/v1/failures/recent?limit=${FEED_SIZE}`, RecentPayload, NO_STORE),
    initialData,
    ...poll,
  }).data;

export const useNow = (startIso: string): number => {
  const [now, setNow] = React.useState(() => Date.parse(startIso));
  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
};
