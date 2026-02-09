import { useState, useEffect, useCallback, useRef } from 'react';
import type { DataMode, YasnoGroupData, YasnoApiResponse } from '../types';

const YASNO_API_URL =
  'https://app.yasno.ua/api/blackout-service/public/shutdowns/regions/25/dsos/902/planned-outages';

/** Local dev proxy (Vite rewrites /api/yasno → app.yasno.ua) */
const DEV_PROXY_URL = '/api/yasno/planned-outages';

/** CORS proxies for production — try in order until one works */
const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const STORAGE_KEY_MODE = 'battery-calc-mode';
const STORAGE_KEY_GROUP = 'battery-calc-group';

export interface UseYasnoDataReturn {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  group: number;
  setGroup: (group: number) => void;
  groupData: YasnoGroupData | null;
  availableGroups: number[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

export function useYasnoData(pollInterval = 60_000): UseYasnoDataReturn {
  const [mode, setModeState] = useState<DataMode>(() => {
    return (localStorage.getItem(STORAGE_KEY_MODE) as DataMode) || 'yasno';
  });

  const [group, setGroupState] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_GROUP);
    return saved ? parseInt(saved, 10) || 39 : 39;
  });

  const [allData, setAllData] = useState<YasnoApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setMode = useCallback((m: DataMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY_MODE, m);
    if (m === 'manual') {
      setError(null);
    }
  }, []);

  const setGroup = useCallback((g: number) => {
    setGroupState(g);
    localStorage.setItem(STORAGE_KEY_GROUP, String(g));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // In dev mode, use Vite proxy first (no CORS issues)
      // In production, try direct → CORS proxies
      const isDev = import.meta.env.DEV;
      const urls = isDev
        ? [DEV_PROXY_URL, YASNO_API_URL, ...CORS_PROXIES.map((p) => p(YASNO_API_URL))]
        : [YASNO_API_URL, ...CORS_PROXIES.map((p) => p(YASNO_API_URL))];
      let lastErr: Error | null = null;

      for (const url of urls) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as YasnoApiResponse;
          setAllData(json);
          setError(null);
          setLastUpdated(new Date());
          return; // success — stop trying
        } catch (e: unknown) {
          lastErr = e as Error;
        }
      }

      // All attempts failed
      throw lastErr ?? new Error('Не вдалося завантажити дані');
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll when in Yasno mode
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (mode === 'yasno') {
      fetchData();
      intervalRef.current = setInterval(fetchData, pollInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mode, pollInterval, fetchData]);

  // Extract current group data
  const groupKey = `${group}.1`;
  const groupData = allData?.[groupKey] ?? null;

  // Build sorted list of available group numbers
  const availableGroups = allData
    ? Object.keys(allData)
        .map((k) => parseInt(k, 10))
        .filter((n) => !isNaN(n) && n > 0)
        .sort((a, b) => a - b)
    : [];

  return {
    mode,
    setMode,
    group,
    setGroup,
    groupData,
    availableGroups,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
  };
}
