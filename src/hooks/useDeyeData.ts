import { useState, useEffect, useCallback, useRef } from 'react';
import type { BatteryMode } from '../types';

const DEYE_API_URL = 'https://eu1-developer.deyecloud.com/v1.0/station/latest';

/** Local dev proxy (Vite rewrites /api/deye → eu1-developer.deyecloud.com) */
const DEV_PROXY_URL = '/api/deye/latest';

/** CORS proxies for production — try in order until one works */
const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const STORAGE_KEY_BATTERY_MODE = 'battery-calc-battery-mode';

export interface UseDeyeDataReturn {
  mode: BatteryMode;
  setMode: (mode: BatteryMode) => void;
  soc: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
  tokenConfigured: boolean;
}

export function useDeyeData(pollInterval = 60_000): UseDeyeDataReturn {
  const token = (import.meta.env.VITE_DEYE_TOKEN as string) || '';
  const stationId = (import.meta.env.VITE_DEYE_STATION_ID as string) || '61180551';
  const tokenConfigured = token.length > 0;

  const [mode, setModeState] = useState<BatteryMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BATTERY_MODE) as BatteryMode;
    if (saved === 'deye' || saved === 'manual') return saved;
    return tokenConfigured ? 'deye' : 'manual';
  });

  const [soc, setSOC] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setMode = useCallback((m: BatteryMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY_BATTERY_MODE, m);
    if (m === 'manual') {
      setError(null);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!token) {
      setError('VITE_DEYE_TOKEN не налаштовано в .env');
      return;
    }

    try {
      setLoading(true);
      const isDev = import.meta.env.DEV;
      const body = JSON.stringify({ stationId: parseInt(stationId, 10) });
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      // In dev → Vite proxy first, then direct, then CORS proxies
      // In prod → direct, then CORS proxies
      const urls = isDev
        ? [DEV_PROXY_URL, DEYE_API_URL, ...CORS_PROXIES.map((p) => p(DEYE_API_URL))]
        : [DEYE_API_URL, ...CORS_PROXIES.map((p) => p(DEYE_API_URL))];

      let lastErr: Error | null = null;

      for (const url of urls) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();

          // Deye API wraps data in { code, msg, data: { batterySOC, ... } }
          const batterySOC = json?.data?.batterySOC ?? json?.batterySOC;
          if (typeof batterySOC !== 'number' && typeof batterySOC !== 'string') {
            throw new Error('batterySOC не знайдено у відповіді');
          }

          const socValue = typeof batterySOC === 'string' ? parseFloat(batterySOC) : batterySOC;
          if (isNaN(socValue)) throw new Error('Невірне значення batterySOC');

          setSOC(socValue);
          setError(null);
          setLastUpdated(new Date());
          return; // success — stop trying
        } catch (e: unknown) {
          lastErr = e as Error;
        }
      }

      // All attempts failed
      throw lastErr ?? new Error('Не вдалося отримати дані');
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || "Помилка з'єднання");
    } finally {
      setLoading(false);
    }
  }, [token, stationId]);

  // Poll when in deye mode and token is configured
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (mode === 'deye' && tokenConfigured) {
      fetchData();
      intervalRef.current = setInterval(fetchData, pollInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mode, tokenConfigured, pollInterval, fetchData]);

  return {
    mode,
    setMode,
    soc,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
    tokenConfigured,
  };
}
